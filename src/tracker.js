const { getActiveWindow } = require('./windows/get-active-window');
const { insertActivity, getSettings } = require('./db');

let intervalId = null;
let tracking = false;
let lastProcess = null;
let lastTitle = null;
let accumulatedSec = 0;
let staleCount = 0; // consecutive polls with same process+title

// Try to get system idle time from Electron's powerMonitor.
// Returns seconds idle, or -1 if unavailable/buggy (Windows sometimes returns 0).
function getSystemIdleSeconds() {
  try {
    const { powerMonitor } = require('electron');
    const idle = powerMonitor.getSystemIdleTime();
    // powerMonitor returns 0 on some Windows builds (known bug) — treat as unavailable
    if (idle === 0) return -1;
    return idle;
  } catch {
    return -1;
  }
}

function startTracking() {
  if (intervalId) return;

  const settings = getSettings();
  const pollSec = parseInt(settings.poll_interval_sec) || 3;
  const pollInterval = pollSec * 1000;
  const idleThresholdSec = parseInt(settings.idle_threshold_sec) || 300;

  tracking = true;
  lastProcess = null;
  lastTitle = null;
  accumulatedSec = 0;
  staleCount = 0;

  intervalId = setInterval(async () => {
    try {
      const win = await getActiveWindow();
      if (!win || !win.processName || !win.windowTitle) return;

      // --- Idle detection (dual signal) ---
      const systemIdle = getSystemIdleSeconds();
      const isSystemIdle = systemIdle >= idleThresholdSec;

      const isSameWindow = win.processName === lastProcess && win.windowTitle === lastTitle;
      if (isSameWindow) {
        staleCount++;
      } else {
        staleCount = 0;
      }
      const staleSec = staleCount * pollSec;
      const isTitleStale = staleSec >= idleThresholdSec;

      // If either signal says idle, skip recording
      if (isSystemIdle || (systemIdle === -1 && isTitleStale)) {
        return;
      }

      // --- Activity recording ---
      if (isSameWindow) {
        accumulatedSec += pollSec;
      } else {
        // Flush previous accumulated activity
        if (lastProcess && accumulatedSec > 0) {
          insertActivity(lastProcess, lastTitle, accumulatedSec);
        }
        lastProcess = win.processName;
        lastTitle = win.windowTitle;
        accumulatedSec = pollSec;
      }
    } catch {
      // Skip this tick silently
    }
  }, pollInterval);
}

function stopTracking() {
  // Flush any remaining accumulated activity
  if (lastProcess && accumulatedSec > 0) {
    insertActivity(lastProcess, lastTitle, accumulatedSec);
    lastProcess = null;
    lastTitle = null;
    accumulatedSec = 0;
    staleCount = 0;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  tracking = false;
}

function isTracking() {
  return tracking;
}

module.exports = { startTracking, stopTracking, isTracking };
