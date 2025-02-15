
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
  });
});

// Ad Blocker
class AdBlocker {
  constructor() {
    this.filterInput = document.getElementById('filter-input');
    this.addFilterBtn = document.getElementById('add-filter');
    this.filtersList = document.getElementById('filters-list');
    
    this.addFilterBtn.addEventListener('click', () => this.addFilter());
    this.loadFilters();
  }

  async loadFilters() {
    const { filters = [] } = await chrome.storage.local.get('filters');
    this.filtersList.innerHTML = ''; 
    filters.forEach(filter => this.renderFilter(filter));
  }

  async addFilter() {
    const filterText = this.filterInput.value.trim();
    if (!filterText) return;

    const { filters = [] } = await chrome.storage.local.get('filters');
    filters.push(filterText);
    await chrome.storage.local.set({ filters });

    this.renderFilter(filterText);
    this.filterInput.value = '';
  }

  renderFilter(filter) {
    const li = document.createElement('li');
    li.textContent = filter;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.classList.add('secondary');
    deleteBtn.addEventListener('click', async () => {
      const { filters = [] } = await chrome.storage.local.get('filters');
      const updatedFilters = filters.filter(f => f !== filter);
      await chrome.storage.local.set({ filters: updatedFilters });
      li.remove();
    });

    li.appendChild(deleteBtn);
    this.filtersList.appendChild(li);
  }
}

// Productivity Tracker
class ProductivityTracker {
  constructor() {
    this.todayUsage = document.getElementById('today-usage');
    this.mostVisited = document.getElementById('most-visited');
    this.loadStats();
    setInterval(() => this.loadStats(), 10000);
  }

  async loadStats() {
    const { timeStats = {} } = await chrome.storage.local.get('timeStats');
    this.updateStats(timeStats);
  }

  updateStats(stats) {
    const today = new Date().toDateString();
    const todayStats = stats[today] || {};

    const todayEntries = Object.entries(todayStats)
      .filter(([key]) => !key.includes('_lastUpdate') && !key.includes('_visits') && key !== 'new tab')
      .sort(([, a], [, b]) => b - a);

    const sortedTodayStats = todayEntries
      .map(([site, time]) => `
        <div class="stat-item">
          <span>${site}</span>
          <span>${this.formatTime(time)}</span>
        </div>
      `)
      .join('');

    this.todayUsage.innerHTML = sortedTodayStats || '<div class="no-data">No data for today</div>';

    const siteStats = {};
    Object.entries(stats).forEach(([date, sites]) => {
      Object.entries(sites).forEach(([key, value]) => {
        if (!key.includes('_lastUpdate') && !key.includes('_visits') && key !== 'new tab') {
          if (!siteStats[key]) {
            siteStats[key] = {
              visits: 0,
              totalTime: 0
            };
          }
          siteStats[key].totalTime += value;
          const visits = sites[`${key}_visits`] || 1;
          siteStats[key].visits += visits;
        }
      });
    });

    const sortedVisitCounts = Object.entries(siteStats)
      .sort(([, a], [, b]) => b.visits - a.visits)
      .map(([site, stats]) => `
        <div class="stat-item">
          <span>${site}</span>
          <span>${stats.visits} visits (${this.formatTime(stats.totalTime)})</span>
        </div>
      `)
      .join('');

    this.mostVisited.innerHTML = sortedVisitCounts || '<div class="no-data">No data available</div>';
  }

  formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }
}

// Notes Manager
class NotesManager {
  constructor() {
    this.noteContent = document.getElementById('note-content');
    this.saveNoteBtn = document.getElementById('save-note');
    this.toggleTypeBtn = document.getElementById('toggle-note-type');
    this.isGlobal = false;

    this.saveNoteBtn.addEventListener('click', () => this.saveNote());
    this.toggleTypeBtn.addEventListener('click', () => this.toggleNoteType());
    this.loadNote();
  }

  async loadNote() {
    const { notes = {} } = await chrome.storage.local.get('notes');
    const key = this.isGlobal ? 'global' : await this.getCurrentUrl();
    this.noteContent.value = notes[key] || '';
  }

  async saveNote() {
    const { notes = {} } = await chrome.storage.local.get('notes');
    const key = this.isGlobal ? 'global' : await this.getCurrentUrl();
    notes[key] = this.noteContent.value;
    await chrome.storage.local.set({ notes });
  }

  async getCurrentUrl() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.url;
  }

  toggleNoteType() {
    this.isGlobal = !this.isGlobal;
    this.toggleTypeBtn.textContent = `Switch to ${this.isGlobal ? 'Local' : 'Global'} Notes`;
    this.loadNote();
  }
}

// Tab Manager
class TabManager {
  constructor() {
    this.groupsList = document.getElementById('tab-groups-list');
    this.saveSessionBtn = document.getElementById('save-session');
    
    this.saveSessionBtn.addEventListener('click', () => this.saveCurrentSession());
    this.loadSessions();
  }

  async loadSessions() {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    this.groupsList.innerHTML = '';
    
    sessions.forEach(session => {
      const div = document.createElement('div');
      div.className = 'session-item';
      
      const title = document.createElement('h3');
      title.textContent = session.name;
      
      const restoreBtn = document.createElement('button');
      restoreBtn.textContent = 'Restore';
      restoreBtn.addEventListener('click', () => this.restoreSession(session));

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.classList.add('secondary');
      deleteBtn.addEventListener('click', async () => {
        await this.deleteSession(session);
      });

      div.appendChild(title);
      const btnContainer = document.createElement('div');
      btnContainer.className = 'button-container';
      btnContainer.appendChild(restoreBtn);
      btnContainer.appendChild(deleteBtn);
      div.appendChild(btnContainer);
      this.groupsList.appendChild(div);
    });
  }

  async saveCurrentSession() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const session = {
      id: Date.now().toString(),
      name: `Session ${new Date().toLocaleString()}`,
      tabs: tabs.map(tab => ({ url: tab.url, title: tab.title }))
    };

    const { sessions = [] } = await chrome.storage.local.get('sessions');
    sessions.push(session);
    await chrome.storage.local.set({ sessions });
    this.loadSessions();
  }

  async restoreSession(session) {
    if (session.tabs.length > 0) {
      const firstTab = session.tabs[0];
      const window = await chrome.windows.create({
        url: firstTab.url
      });
      for (let i = 1; i < session.tabs.length; i++) {
        await chrome.tabs.create({
          windowId: window.id,
          url: session.tabs[i].url
        });
      }
    }
  }

  async deleteSession(session) {
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    const updatedSessions = sessions.filter(s => s.id !== session.id);
    await chrome.storage.local.set({ sessions: updatedSessions }); 
    await this.loadSessions(); 
  }
}

// Theme Manager
class ThemeManager {
  constructor() {
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.root = document.documentElement;
    
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    this.loadTheme();
  }

  async loadTheme() {
    const { theme = 'light' } = await chrome.storage.local.get('theme');
    this.setTheme(theme);
  }

  async toggleTheme() {
    const currentTheme = this.root.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    await chrome.storage.local.set({ theme: newTheme });
    this.setTheme(newTheme);
  }

  setTheme(theme) {
    this.root.setAttribute('data-theme', theme);
  }
}

// Initialize all features
document.addEventListener('DOMContentLoaded', () => {
  new ThemeManager();
  new AdBlocker();
  new ProductivityTracker();
  new NotesManager();
  new TabManager();
});