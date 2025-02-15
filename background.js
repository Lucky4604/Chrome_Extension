
let startTime = Date.now();
let currentTab = null;
let isWindowFocused = true;


chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    currentTab = tabs[0];
    startTime = Date.now();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (currentTab) {
    await updateTimeStats();
  }
  currentTab = tab;
  startTime = Date.now();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    await updateTimeStats();
  } else {
    isWindowFocused = true;
    startTime = Date.now();
  }
});


chrome.tabs.onRemoved.addListener(async () => {
  if (currentTab) {
    await updateTimeStats();
  }
});


setInterval(async () => {
  if (currentTab && isWindowFocused) {
    await updateTimeStats();
    startTime = Date.now(); 
  }
}, 10000); 

async function updateTimeStats() {
  if (!currentTab || !currentTab.url || !isWindowFocused) return;

  try {
    const domain = new URL(currentTab.url).hostname;
    if (!domain) return;

    const today = new Date().toDateString();
    const timeSpent = Date.now() - startTime;

 
    if (timeSpent < 1000) return;

    const { timeStats = {} } = await chrome.storage.local.get('timeStats');
    

    if (!timeStats[today]) {
      timeStats[today] = {};
    }


    timeStats[today][domain] = (timeStats[today][domain] || 0) + timeSpent;


    const lastUpdate = timeStats[today][`${domain}_lastUpdate`] || 0;
    const VISIT_GAP_THRESHOLD = 5 * 60 * 1000; 
    
    if (!lastUpdate || Date.now() - lastUpdate > VISIT_GAP_THRESHOLD) {
      timeStats[today][`${domain}_visits`] = (timeStats[today][`${domain}_visits`] || 0) + 1;
    }
    
    timeStats[today][`${domain}_lastUpdate`] = Date.now();

    await chrome.storage.local.set({ timeStats });
    startTime = Date.now();
  } catch (error) {
    console.error('Error updating time stats:', error);
  }
}

// Ad Blocker
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    const { filters = [] } = await chrome.storage.local.get('filters');
    return {
      cancel: filters.some(filter => details.url.includes(filter))
    };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);