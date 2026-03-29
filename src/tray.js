const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

function createTray(mainWindow) {
  // Create a simple 16x16 icon programmatically (blue circle)
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback: create a tiny icon from data URL
    trayIcon = nativeImage.createEmpty();
  }

  // Resize for tray
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  const tray = new Tray(trayIcon.isEmpty() ? createDefaultIcon() : trayIcon);

  const updateMenu = () => {
    const tracker = require('./tracker');
    const isTracking = tracker.isTracking();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Haru-Haru',
        enabled: false
      },
      { type: 'separator' },
      {
        label: '대시보드 열기',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      {
        label: isTracking ? '추적 일시정지' : '추적 재개',
        click: () => {
          if (isTracking) {
            tracker.stopTracking();
          } else {
            tracker.startTracking();
          }
          updateMenu();
        }
      },
      { type: 'separator' },
      {
        label: '종료',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip(isTracking ? 'Haru-Haru - 추적 중' : 'Haru-Haru - 일시정지');
  };

  updateMenu();

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

function createDefaultIcon() {
  // Create a minimal 16x16 PNG icon (blue square)
  const { nativeImage } = require('electron');
  // Simple 16x16 blue pixel buffer
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buffer[i * 4] = 66;      // R
    buffer[i * 4 + 1] = 133; // G
    buffer[i * 4 + 2] = 244; // B
    buffer[i * 4 + 3] = 255; // A
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

module.exports = { createTray };
