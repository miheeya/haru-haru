const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./src/db');
const tracker = require('./src/tracker');
const { createTray } = require('./src/tray');
const { generateDailySummary, generateMorningBriefing, generateWeeklyReport } = require('./src/ai-summary');

let mainWindow = null;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function registerIPC() {
  ipcMain.handle('get-day-summary', (_event, date) => {
    return db.getDaySummary(date);
  });

  ipcMain.handle('get-journal', (_event, date) => {
    return db.getJournal(date);
  });

  ipcMain.handle('save-journal-note', (_event, date, note) => {
    db.saveJournalNote(date, note);
  });

  ipcMain.handle('generate-summary', async (_event, date) => {
    try {
      const summary = await generateDailySummary(date);
      return { summary };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('get-settings', () => {
    return db.getSettings();
  });

  ipcMain.handle('save-settings', (_event, settings) => {
    db.saveSettings(settings);
  });

  ipcMain.handle('get-app-details', (_event, date, processName) => {
    return db.getAppDetails(date, processName);
  });

  ipcMain.handle('add-manual-activity', (_event, date, processName, windowTitle, durationMin) => {
    db.insertManualActivity(date, processName, windowTitle, durationMin);
  });

  ipcMain.handle('update-manual-activity', (_event, id, durationMin) => {
    db.updateManualActivity(id, durationMin);
  });

  ipcMain.handle('delete-activity', (_event, processName, date) => {
    db.deleteActivity(processName, date);
  });

  ipcMain.handle('get-tracking-status', () => {
    return { isTracking: tracker.isTracking() };
  });

  ipcMain.handle('toggle-tracking', () => {
    if (tracker.isTracking()) {
      tracker.stopTracking();
      return { isTracking: false };
    } else {
      tracker.startTracking();
      return { isTracking: true };
    }
  });

  // --- v2: Briefing, Stats, Categories ---

  ipcMain.handle('get-morning-briefing', async (_event, date) => {
    try {
      const briefing = await generateMorningBriefing(date);
      return { briefing };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('get-daily-stats', (_event, date) => {
    return db.getDailyStats(date);
  });

  ipcMain.handle('get-weekly-stats', (_event, endDate) => {
    return db.getWeeklyStats(endDate);
  });

  ipcMain.handle('get-monthly-stats', (_event, yearMonth) => {
    return db.getMonthlyStats(yearMonth);
  });

  ipcMain.handle('get-category-map', () => {
    return db.getCategoryMap();
  });

  ipcMain.handle('update-category', (_event, id, category) => {
    db.updateCategory(id, category);
  });

  ipcMain.handle('add-category-rule', (_event, processName, titlePattern, category) => {
    db.addCategoryRule(processName, titlePattern, category);
  });

  ipcMain.handle('generate-weekly-report', async (_event, weekEndDate) => {
    try {
      const report = await generateWeeklyReport(weekEndDate);
      return { report };
    } catch (err) {
      return { error: err.message };
    }
  });
}

app.whenReady().then(async () => {
  await db.initDB();
  createWindow();
  registerIPC();
  tray = createTray(mainWindow);
  tracker.startTracking();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  tracker.stopTracking();
  db.saveDB();
});

app.on('window-all-closed', () => {
  // On Windows, keep running in tray
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
