document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const maxRetriesInput = document.getElementById('maxRetries');
  const waitTimeInput = document.getElementById('waitTime');
  const statusDiv = document.getElementById('status');
  
  // Check current state when popup opens
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTabId = tabs[0].id;
    
    // Get the active tab's refreshing state
    chrome.storage.local.get(['refreshingTabs'], function(result) {
      const refreshingTabs = result.refreshingTabs || {};
      const isRefreshing = refreshingTabs[currentTabId] || false;
      
      updateUI(isRefreshing);
    });
  });
  
  // Start refreshing
  startBtn.addEventListener('click', function() {
    const maxRetries = parseInt(maxRetriesInput.value);
    const waitTime = parseInt(waitTimeInput.value);
    
    if (maxRetries < 1 || waitTime < 1) {
      statusDiv.textContent = 'Invalid values';
      return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTabId = tabs[0].id;
      
      chrome.runtime.sendMessage({
        action: 'startRefreshing', 
        tabId: currentTabId,
        maxRetries: maxRetries,
        waitTime: waitTime,
        url: tabs[0].url
      });
      
      // Update storage with tab-specific refreshing state
      chrome.storage.local.get(['refreshingTabs'], function(result) {
        const refreshingTabs = result.refreshingTabs || {};
        refreshingTabs[currentTabId] = true;
        chrome.storage.local.set({refreshingTabs: refreshingTabs});
      });
      
      updateUI(true);
    });
  });
  
  // Stop refreshing
  stopBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTabId = tabs[0].id;
      
      chrome.runtime.sendMessage({
        action: 'stopRefreshing',
        tabId: currentTabId
      });
      
      // Update storage with tab-specific refreshing state
      chrome.storage.local.get(['refreshingTabs'], function(result) {
        const refreshingTabs = result.refreshingTabs || {};
        refreshingTabs[currentTabId] = false;
        chrome.storage.local.set({refreshingTabs: refreshingTabs});
      });
      
      updateUI(false);
    });
  });
  
  function updateUI(isRefreshing) {
    startBtn.disabled = isRefreshing;
    stopBtn.disabled = !isRefreshing;
    
    if (isRefreshing) {
      statusDiv.textContent = 'Refreshing active';
      statusDiv.classList.add('active');
    } else {
      statusDiv.textContent = 'Ready';
      statusDiv.classList.remove('active');
    }
  }
});