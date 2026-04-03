const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDaySummary: (date) => ipcRenderer.invoke('get-day-summary', date),
  getJournal: (date) => ipcRenderer.invoke('get-journal', date),
  saveJournalNote: (date, note) => ipcRenderer.invoke('save-journal-note', date, note),
  getTodos: (date) => ipcRenderer.invoke('get-todos', date),
  saveTodos: (date, todos) => ipcRenderer.invoke('save-todos', date, todos),
  exportData: () => ipcRenderer.invoke('export-data'),
  resetAllData: () => ipcRenderer.invoke('reset-all-data'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getAppDetails: (date, processName) =>
    ipcRenderer.invoke('get-app-details', date, processName),
  addManualActivity: (date, processName, windowTitle, durationMin) =>
    ipcRenderer.invoke('add-manual-activity', date, processName, windowTitle, durationMin),
  updateManualActivity: (id, durationMin) =>
    ipcRenderer.invoke('update-manual-activity', id, durationMin),
  deleteActivity: (processName, date) =>
    ipcRenderer.invoke('delete-activity', processName, date),
  getTrackingStatus: () => ipcRenderer.invoke('get-tracking-status'),
  toggleTracking: () => ipcRenderer.invoke('toggle-tracking'),

  // v2: Stats, Categories
  getIdleGaps: (date) => ipcRenderer.invoke('get-idle-gaps', date),
  getDailyStats: (date) => ipcRenderer.invoke('get-daily-stats', date),
  getWeeklyStats: (endDate) => ipcRenderer.invoke('get-weekly-stats', endDate),
  getMonthlyStats: (yearMonth) => ipcRenderer.invoke('get-monthly-stats', yearMonth),
  getCategoryMap: () => ipcRenderer.invoke('get-category-map'),
  updateCategory: (id, category) => ipcRenderer.invoke('update-category', id, category),
  addCategoryRule: (processName, titlePattern, category) =>
    ipcRenderer.invoke('add-category-rule', processName, titlePattern, category),
});
