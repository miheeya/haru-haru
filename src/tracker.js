const { getActiveWindow } = process.platform === 'darwin'
  ? require('./macos/get-active-window')
  : require('./windows/get-active-window');
const { insertActivity, getSettings } = require('./db');

// Window titles to ignore (noise: emoticon pickers, system windows, toast popups)
const TITLE_FILTERS = [
  /^이모티콘\(/,           // KakaoWork/KakaoTalk emoticon picker
  /^ToastWindow$/,         // KakaoWork toast notification
  /^Default IME$/,         // IME system window
  /^MSCTFIME UI$/,         // IME system window
  /^GDI\+ Window/,         // GDI system window
  /^CiceroUIWndFrame$/,    // IME frame
  /^SystemResource/,       // System resource notification
  /^Hidden Window$/,       // Hidden system window
];

function shouldFilterTitle(title) {
  return TITLE_FILTERS.some(re => re.test(title));
}

const FLUSH_INTERVAL_SEC = 60;        // Flush to DB even if window doesn't change
const STALE_FALLBACK_SEC = 1800;      // 30min — only used when powerMonitor unavailable

let intervalId = null;
let tracking = false;
let lastProcess = null;
let lastTitle = null;
let accumulatedSec = 0;
let staleCount = 0; // consecutive polls with same process+title

// Try to get system idle time from Electron's powerMonitor.
// Returns seconds idle (0 = user just interacted), or -1 if genuinely unavailable.
function getSystemIdleSeconds() {
  try {
    const { powerMonitor } = require('electron');
    return powerMonitor.getSystemIdleTime(); // 0 means active, not a bug
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

      // Filter out noise windows (emoticon pickers, toast notifications, etc.)
      if (shouldFilterTitle(win.windowTitle)) return;

      // --- Idle detection ---
      const systemIdle = getSystemIdleSeconds();
      const isSystemIdle = systemIdle >= 0 && systemIdle >= idleThresholdSec;

      const isSameWindow = win.processName === lastProcess && win.windowTitle === lastTitle;
      if (isSameWindow) {
        staleCount++;
      } else {
        staleCount = 0;
      }

      // Stale fallback: only when powerMonitor genuinely unavailable (-1).
      // Use 30min threshold — title staleness is a poor idle proxy.
      const staleSec = staleCount * pollSec;
      const isTitleStale = staleSec >= STALE_FALLBACK_SEC;

      if (isSystemIdle || (systemIdle === -1 && isTitleStale)) {
        return;
      }

      // --- Activity recording ---
      if (isSameWindow) {
        accumulatedSec += pollSec;
        if (accumulatedSec >= FLUSH_INTERVAL_SEC) {
          insertActivity(lastProcess, lastTitle, accumulatedSec);
          accumulatedSec = 0;
        }
      } else {
        // Window changed: flush previous accumulated activity
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
