const { execFile } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'get-active-window.ps1');

function getActiveWindow() {
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: 5000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        try {
          // Decode Base64 → UTF-8 JSON
          const base64 = stdout.trim();
          const json = Buffer.from(base64, 'base64').toString('utf8');
          const result = JSON.parse(json);
          if (!result.windowTitle && !result.processName) {
            resolve(null);
            return;
          }
          resolve({
            processName: result.processName || 'unknown',
            windowTitle: result.windowTitle || ''
          });
        } catch {
          resolve(null);
        }
      }
    );
  });
}

module.exports = { getActiveWindow };
