
// Flag to track if we've already determined the page is fully loaded
let pageFullyLoadedReported = false;
let loadCheckAttempts = 0;
const MAX_LOAD_CHECK_ATTEMPTS = 3; // Number of consecutive successful checks before confirming fully loaded

// Create a notification element
function createNotificationElement(message, type) {
  // Remove any existing notification
  const existingNotification = document.getElementById('auto-refresher-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.id = 'auto-refresher-notification';
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.padding = '15px 20px';
  notification.style.borderRadius = '5px';
  notification.style.zIndex = '10000';
  notification.style.fontFamily = 'Arial, sans-serif';
  notification.style.fontSize = '14px';
  notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  
  if (type === 'success') {
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#F44336';
    notification.style.color = 'white';
  } else {
    notification.style.backgroundColor = '#2196F3';
    notification.style.color = 'white';
  }
  
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Improved check if the page is fully loaded
function isPageFullyLoaded() {
  // Basic document ready check
  if (document.readyState !== 'complete') {
    return false;
  }
  
  // Check if the body has content
  if (!document.body || document.body.children.length === 0) {
    return false;
  }
  
  // Check for main content (more specific selectors based on common page structure)
  const mainContentSelectors = [
    'main', 
    '#main', 
    '#content', 
    '.content', 
    'article',
    '#root',
    '#app'
  ];
  
  let hasMainContent = false;
  for (const selector of mainContentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.children.length > 0) {
      hasMainContent = true;
      break;
    }
  }
  
  // If we can't find specific main content containers, check if the page has enough content
  if (!hasMainContent) {
    // Check if page has a reasonable amount of content
    const contentElements = document.querySelectorAll('div, p, ul, ol, table, form');
    if (contentElements.length < 3) {
      return false;
    }
  }
  
  // Check if there are any loading indicators still visible
  const loadingIndicators = [
    '.loading', 
    '.loader', 
    '.spinner',
    '[data-loading="true"]',
    'progress',
    '.progress',
    '.preloader',
    '#loading',
    '.loading-spinner',
    '[aria-busy="true"]'
  ];
  
  for (const selector of loadingIndicators) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element && element.offsetParent !== null) { // Check if visible
        return false;
      }
    }
  }
  
  // Check if images above the fold are loaded
  const viewportHeight = window.innerHeight;
  const visibleImages = Array.from(document.querySelectorAll('img')).filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.top < viewportHeight && rect.bottom > 0;
  });
  
  if (visibleImages.length > 0) {
    const unloadedImages = visibleImages.filter(img => !img.complete);
    if (unloadedImages.length > 0) {
      return false;
    }
  }
  
  // Check for dynamic content loading (infinite scroll, lazy loading)
  // This is a heuristic - we check if the page height is stable
  const pageHeight = document.documentElement.scrollHeight;
  
  // Store the current height to compare in the next check
  if (!window.lastPageHeight) {
    window.lastPageHeight = pageHeight;
    return false; // First check, wait to confirm stability
  } else if (window.lastPageHeight !== pageHeight) {
    window.lastPageHeight = pageHeight;
    return false; // Height changed, content still loading
  }
  
  return true;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'checkPageLoaded') {
    const fullyLoaded = isPageFullyLoaded();
    
    // Reset attempts counter if not loaded
    if (!fullyLoaded) {
      loadCheckAttempts = 0;
      sendResponse({fullyLoaded: false});
      return true;
    }
    
    // Increment attempts counter if loaded
    loadCheckAttempts++;
    
    // If we've had enough consecutive successful checks
    if (loadCheckAttempts >= MAX_LOAD_CHECK_ATTEMPTS && !pageFullyLoadedReported) {
      pageFullyLoadedReported = true;
      
      // Notify the background script
      chrome.runtime.sendMessage({
        action: 'pageFullyLoaded'
      });
      
      sendResponse({fullyLoaded: true});
    } else {
      sendResponse({fullyLoaded: false}); // Still waiting for consistent success
    }
  }
  else if (request.action === 'showSuccessNotification') {
    createNotificationElement('Page successfully loaded!', 'success');
  }
  else if (request.action === 'showMaxRetriesNotification') {
    createNotificationElement('Max retries reached. Page may not be fully loaded.', 'error');
  }
  
  return true; // Keep the message channel open for sendResponse
});

// Initialize on page load
window.addEventListener('load', function() {
  // Reset flags on new page load
  pageFullyLoadedReported = false;
  loadCheckAttempts = 0;
  window.lastPageHeight = null;
  
  // Check after a short delay to allow for post-load scripts
  setTimeout(() => {
    const fullyLoaded = isPageFullyLoaded();
    if (fullyLoaded) {
      loadCheckAttempts++;
      
      // Require multiple checks to confirm
      if (loadCheckAttempts >= MAX_LOAD_CHECK_ATTEMPTS) {
        pageFullyLoadedReported = true;
        chrome.runtime.sendMessage({action: 'pageFullyLoaded'});
      }
    }
  }, 1000);
});