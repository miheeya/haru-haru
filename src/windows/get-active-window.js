const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptPath = path.join(__dirname, 'get-active-window.ps1');

// Read script once at module load, pass via -Command to avoid -File encoding issues
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Throttle: skip if previous call hasn't resolved yet
let inFlight = false;

function getActiveWindow() {
  if (inFlight) return Promise.resolve(null);
  inFlight = true;

  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', scriptContent],
      { timeout: 5000, windowsHide: true },
      (error, stdout) => {
        inFlight = false;
        if (error) { resolve(null); return; }
        try {
          const base64 = stdout.trim();
          if (!base64) { resolve(null); return; }
          const json = Buffer.from(base64, 'base64').toString('utf8');
          const result = JSON.parse(json);
          if (!result.windowTitle && !result.processName) { resolve(null); return; }
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
