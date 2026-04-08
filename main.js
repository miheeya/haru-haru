const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('./src/db');
const tracker = require('./src/tracker');
const { createTray } = require('./src/tray');
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

  // Zoom: Ctrl+= zoom in, Ctrl+0 reset (Ctrl+- already works via Electron default)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const mod = process.platform === 'darwin' ? input.meta : input.control;
    if (mod && !input.alt && input.type === 'keyDown') {
      // Use input.code (physical key) to avoid keyboard layout issues
      if (input.code === 'Equal' || input.code === 'NumpadAdd') {
        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5);
        event.preventDefault();
      } else if (input.code === 'Digit0' || input.code === 'Numpad0') {
        mainWindow.webContents.setZoomLevel(0);
        event.preventDefault();
      }
    }
  });

  const startHidden = process.argv.includes('--hidden');
  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow.show();
    }
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

  ipcMain.handle('get-todos', (_event, date) => {
    return db.getTodos(date);
  });

  ipcMain.handle('save-todos', (_event, date, todos) => {
    db.saveTodos(date, todos);
  });

  ipcMain.handle('export-data', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '내보내기 폴더 선택',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };

    const dir = result.filePaths[0];
    const today = new Date().toISOString().split('T')[0];
    const BOM = '\uFEFF';

    // Activity log CSV
    const logs = db.exportActivityLog();
    const logCsv = BOM + '날짜시간,앱,창 제목,사용시간(초),직접입력\n' +
      logs.map(r => `"${r.timestamp}","${(r.process_name || '').replace(/"/g, '""')}","${(r.window_title || '').replace(/"/g, '""')}",${r.duration_sec},${r.is_manual ? '예' : '아니오'}`).join('\n');
    fs.writeFileSync(path.join(dir, `하루하루_활동로그_${today}.csv`), logCsv, 'utf8');

    // Daily summary CSV
    const summary = db.exportDailySummary();
    const sumCsv = BOM + '날짜,앱,사용시간(초),사용시간\n' +
      summary.map(r => {
        const h = Math.floor(r.total_sec / 3600);
        const m = Math.floor((r.total_sec % 3600) / 60);
        const timeStr = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
        return `"${r.date}","${(r.process_name || '').replace(/"/g, '""')}",${r.total_sec},"${timeStr}"`;
      }).join('\n');
    fs.writeFileSync(path.join(dir, `하루하루_일별요약_${today}.csv`), sumCsv, 'utf8');

    return { success: true, dir, fileCount: 2 };
  });

  ipcMain.handle('reset-all-data', () => {
    db.resetAllData();
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

  ipcMain.handle('get-idle-gaps', (_event, date) => {
    return db.getIdleGaps(date);
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

  // --- Auto-start ---

  ipcMain.handle('get-autostart', () => {
    if (!app.isPackaged) return false;
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('set-autostart', (_event, enabled) => {
    if (!app.isPackaged) return false;
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
    return app.getLoginItemSettings().openAtLogin;
  });

  // --- Update check ---

  ipcMain.handle('check-for-updates', async () => {
    const updater = require('./src/updater');
    return updater.checkForUpdates(app.getVersion());
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

}

app.whenReady().then(async () => {
  await db.initDB();
  createWindow();
  registerIPC();
  tray = createTray(mainWindow);
  tracker.startTracking();

  // Background update check (once per 24h)
  try {
    const settings = db.getSettings();
    const lastCheck = settings.last_update_check ? new Date(settings.last_update_check).getTime() : 0;
    const hoursSinceCheck = (Date.now() - lastCheck) / (1000 * 60 * 60);
    if (hoursSinceCheck >= 24) {
      const updater = require('./src/updater');
      const result = await updater.checkForUpdates(app.getVersion());
      db.saveSettings({ last_update_check: new Date().toISOString() });
      if (result.hasUpdate) {
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('update-available', result);
        });
        // If already loaded, send immediately
        if (!mainWindow.webContents.isLoading()) {
          mainWindow.webContents.send('update-available', result);
        }
      }
    }
  } catch {}
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
