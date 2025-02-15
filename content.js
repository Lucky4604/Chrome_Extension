let startTime = Date.now();
let currentTab = null;


chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    currentTab = tabs[0];
    startTime = Date.now();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  updateTimeStats();
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    currentTab = tab;
    startTime = Date.now();
  } catch (error) {
    console.error("Error getting tab information:", error);
  }
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateTimeStats();
    currentTab = tab;
    startTime = Date.now();
  }
});


chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    updateTimeStats();
  } else {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs.length > 0) {
        updateTimeStats();
        currentTab = tabs[0];
        startTime = Date.now();
      }
    });
  }
});

async function updateTimeStats() {
  if (!currentTab || !currentTab.url) return;
  
  try {
    const domain = new URL(currentTab.url).hostname;
    if (!domain) return; 
    
    const today = new Date().toDateString();
    const timeSpent = Date.now() - startTime;

    if (timeSpent < 1000) return;
    
    const { timeStats = {} } = await chrome.storage.local.get('timeStats');
    timeStats[today] = timeStats[today] || {};
    timeStats[today][domain] = (timeStats[today][domain] || 0) + timeSpent;
    
    await chrome.storage.local.set({ timeStats });
    console.log(`Updated time for ${domain}: +${Math.round(timeSpent/1000)}s, total: ${Math.round(timeStats[today][domain]/1000)}s`);
  } catch (error) {
    console.error("Error updating time stats:", error);
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    try {
      const { filters = [] } = await chrome.storage.local.get('filters');
      return {
        cancel: filters.some(filter => details.url.includes(filter))
      };
    } catch (error) {
      console.error("Error in ad blocking:", error);
      return { cancel: false };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);