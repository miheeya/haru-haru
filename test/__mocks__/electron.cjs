const os = require('os');
module.exports = {
  app: { getPath: () => os.tmpdir() },
  BrowserWindow: class {},
  ipcMain: { handle: () => {} },
  Tray: class {},
  Menu: { buildFromTemplate: () => ({}) },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }), createEmpty: () => ({ isEmpty: () => true }) },
};
