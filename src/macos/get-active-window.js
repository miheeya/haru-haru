const { execFile } = require('child_process');

let inFlight = false;

const SEP = '\x1F'; // ASCII unit separator — safe delimiter, cannot appear in app/window names

const script = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  try
    set winTitle to name of front window of frontApp
  on error
    set winTitle to ""
  end try
end tell
return appName & (ASCII character 31) & winTitle
`;

function getActiveWindow() {
  if (inFlight) return Promise.resolve(null);
  inFlight = true;

  return new Promise((resolve) => {
    execFile(
      'osascript',
      ['-e', script],
      { timeout: 5000 },
      (error, stdout) => {
        inFlight = false;
        if (error) { resolve(null); return; }
        try {
          const output = stdout.trim();
          if (!output) { resolve(null); return; }
          const sep = output.indexOf(SEP);
          const processName = sep >= 0 ? output.substring(0, sep) : output;
          const windowTitle = sep >= 0 ? output.substring(sep + 1) : '';
          if (!processName) { resolve(null); return; }
          resolve({ processName, windowTitle });
        } catch {
          resolve(null);
        }
      }
    );
  });
}

module.exports = { getActiveWindow };
