// Store refresh intervals by tab ID
const refreshIntervals = {};
const retryCounters = {};
const maxRetriesStore = {};
const refreshURLs = {};

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startRefreshing') {
    const tabId = request.tabId;
    maxRetriesStore[tabId] = request.maxRetries;
    const waitTime = request.waitTime * 1000; // Convert to milliseconds
    refreshURLs[tabId] = request.url;
    
    // Reset retry counter for this tab
    retryCounters[tabId] = 0;
    
    // Clear any existing interval for this tab
    if (refreshIntervals[tabId]) {
      clearInterval(refreshIntervals[tabId]);
    }
    
    // Inject the content script to check page loading
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ['content.js']
    });
    
    // Set up refresh interval for this tab
    refreshIntervals[tabId] = setInterval(function() {
      checkAndRefresh(tabId);
    }, waitTime);
    
    sendResponse({status: 'started'});
  } 
  else if (request.action === 'stopRefreshing') {
    const tabId = request.tabId;
    stopRefreshing(tabId);
    sendResponse({status: 'stopped'});
  }
  else if (request.action === 'pageFullyLoaded') {
    // Get the tab ID from sender
    const tabId = sender.tab.id;
    
    // Page is fully loaded, stop refreshing
    stopRefreshing(tabId);
    
    // Update storage
    chrome.storage.local.get(['refreshingTabs'], function(result) {
      const refreshingTabs = result.refreshingTabs || {};
      refreshingTabs[tabId] = false;
      chrome.storage.local.set({refreshingTabs: refreshingTabs});
    });
    
    // Send notification
    chrome.tabs.sendMessage(tabId, {action: 'showSuccessNotification'});
  }
  return true; // Keep the message channel open for sendResponse
});

function checkAndRefresh(tabId) {
  // Check if URL has changed
  chrome.tabs.get(tabId, function(tab) {
    if (chrome.runtime.lastError) {
      // Tab might be closed
      stopRefreshing(tabId);
      return;
    }
    
    // If URL has changed, stop refreshing
    if (tab.url !== refreshURLs[tabId]) {
      stopRefreshing(tabId);
      
      // Update storage
      chrome.storage.local.get(['refreshingTabs'], function(result) {
        const refreshingTabs = result.refreshingTabs || {};
        refreshingTabs[tabId] = false;
        chrome.storage.local.set({refreshingTabs: refreshingTabs});
      });
      return;
    }
    
    if (retryCounters[tabId] >= maxRetriesStore[tabId]) {
      stopRefreshing(tabId);
      
      // Update storage
      chrome.storage.local.get(['refreshingTabs'], function(result) {
        const refreshingTabs = result.refreshingTabs || {};
        refreshingTabs[tabId] = false;
        chrome.storage.local.set({refreshingTabs: refreshingTabs});
      });
      
      // Send notification about max retries reached
      chrome.tabs.sendMessage(tabId, {action: 'showMaxRetriesNotification'});
      return;
    }
    
    // Check if the page is fully loaded first
    chrome.tabs.sendMessage(tabId, {action: 'checkPageLoaded'}, function(response) {
      // If we get a runtime error, the content script might not be loaded
      if (chrome.runtime.lastError) {
        retryCounters[tabId]++;
        chrome.tabs.reload(tabId);
        return;
      }
      
      // If we don't get a successful response or the page isn't loaded, refresh
      if (!response || response.fullyLoaded === false) {
        retryCounters[tabId]++;
        chrome.tabs.reload(tabId);
      } else if (response.fullyLoaded === true) {
        // Page is fully loaded, stop refreshing
        stopRefreshing(tabId);
        
        // Update storage
        chrome.storage.local.get(['refreshingTabs'], function(result) {
          const refreshingTabs = result.refreshingTabs || {};
          refreshingTabs[tabId] = false;
          chrome.storage.local.set({refreshingTabs: refreshingTabs});
        });
        
        // Send notification
        chrome.tabs.sendMessage(tabId, {action: 'showSuccessNotification'});
      }
    });
  });
}

function stopRefreshing(tabId) {
  if (refreshIntervals[tabId]) {
    clearInterval(refreshIntervals[tabId]);
    delete refreshIntervals[tabId];
    delete retryCounters[tabId];
    delete maxRetriesStore[tabId];
    delete refreshURLs[tabId];
  }
}

// Handle tab closure
chrome.tabs.onRemoved.addListener(function(tabId) {
  stopRefreshing(tabId);
  
  // Clean up storage
  chrome.storage.local.get(['refreshingTabs'], function(result) {
    const refreshingTabs = result.refreshingTabs || {};
    if (refreshingTabs[tabId]) {
      delete refreshingTabs[tabId];
      chrome.storage.local.set({refreshingTabs: refreshingTabs});
    }
  });
});

// Clean up when the extension is updated or reloaded
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.set({refreshingTabs: {}});
});