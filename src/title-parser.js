// Browser process names and their title suffixes
const BROWSER_SUFFIXES = {
  chrome: ' - Google Chrome',
  msedge: ' - Microsoft Edge',
  firefox: ' - Mozilla Firefox',
  brave: ' - Brave',
  opera: ' - Opera',
  vivaldi: ' - Vivaldi',
};

// Known app suffixes
const APP_SUFFIXES = {
  Code: ' - Visual Studio Code',
  slack: ' - Slack',
  discord: ' - Discord',
  notion: ' | Notion',
};

const TERMINAL_NAMES = new Set([
  'WindowsTerminal', 'powershell', 'pwsh', 'cmd',
  'bash', 'mintty', 'wt', 'ConEmu', 'ConEmu64',
]);

/**
 * Parse a window title into a cleaner label based on the process name.
 * @param {string} processName
 * @param {string} windowTitle
 * @returns {string} cleaned label
 */
function parseTitle(processName, windowTitle) {
  if (!windowTitle) return '(제목 없음)';

  const lowerProcess = processName.toLowerCase();

  // Browsers: remove the " - Browser Name" suffix
  for (const [browser, suffix] of Object.entries(BROWSER_SUFFIXES)) {
    if (lowerProcess === browser || lowerProcess === browser + '.exe') {
      if (windowTitle.endsWith(suffix)) {
        return windowTitle.slice(0, -suffix.length).trim() || windowTitle;
      }
      // Also try case-insensitive match for Edge variants
      const idx = windowTitle.lastIndexOf(' - ');
      if (idx > 0) {
        return windowTitle.slice(0, idx).trim();
      }
      return windowTitle;
    }
  }

  // Known apps: remove their suffix
  for (const [app, suffix] of Object.entries(APP_SUFFIXES)) {
    if (processName === app || lowerProcess === app.toLowerCase()) {
      if (windowTitle.endsWith(suffix)) {
        return windowTitle.slice(0, -suffix.length).trim() || windowTitle;
      }
      const idx = windowTitle.lastIndexOf(' - ');
      if (idx > 0) {
        return windowTitle.slice(0, idx).trim();
      }
      return windowTitle;
    }
  }

  // Messengers: clean up timestamp suffixes from chat titles
  // KakaoWork: "max.0420 (이호경) - 4월 3일 (금) 오전 11:15" → "max.0420 (이호경)"
  // KakaoTalk: titles are already clean (just contact/room name)
  if (lowerProcess === 'kakaowork' || lowerProcess === 'kakaotalk') {
    // Remove trailing " - 날짜 시간" pattern
    const datePattern = / - \d{1,2}월 \d{1,2}일 \(.\) (오전|오후) \d{1,2}:\d{2}$/;
    return windowTitle.replace(datePattern, '').trim();
  }

  // Terminals: keep as-is (contains path/command info)
  if (TERMINAL_NAMES.has(processName) || TERMINAL_NAMES.has(lowerProcess)) {
    return windowTitle;
  }

  // Default: try to remove trailing " - AppName" pattern
  const idx = windowTitle.lastIndexOf(' - ');
  if (idx > 0 && idx > windowTitle.length * 0.3) {
    return windowTitle.slice(0, idx).trim();
  }

  return windowTitle;
}

// --- Category classification by heuristics (fallback when DB has no match) ---

const BROWSER_NAMES = new Set(Object.keys(BROWSER_SUFFIXES));

const DEV_KEYWORDS = ['github', 'gitlab', 'bitbucket', 'stack overflow', 'stackoverflow',
  'localhost', 'codepen', 'jsfiddle', 'replit', 'codesandbox', 'npm', 'docs.rs'];
const SNS_KEYWORDS = ['youtube', 'twitter', 'instagram', 'facebook', 'reddit', 'tiktok',
  'twitch', 'discord', 'naver', 'daum', '카카오'];
const COMM_KEYWORDS = ['gmail', 'outlook', 'mail', 'slack', 'teams', 'zoom', '카카오톡'];
const DOC_KEYWORDS = ['google docs', 'google sheets', 'notion', 'confluence', 'figma',
  'miro', 'drive.google'];

/**
 * Classify an activity into a category based on process name and window title.
 * Used as a fallback when the categories DB table has no matching rule.
 */
function categorizeByTitle(processName, windowTitle) {
  if (!processName) return '기타';
  const lowerProcess = processName.toLowerCase().replace('.exe', '');
  const lowerTitle = (windowTitle || '').toLowerCase();

  // Known dev tools
  if (['code', 'vim', 'nvim', 'emacs', 'idea64', 'idea', 'webstorm', 'pycharm',
       'goland', 'rider', 'datagrip', 'android studio'].includes(lowerProcess)) {
    return '개발';
  }

  // Terminals
  if (TERMINAL_NAMES.has(processName) || TERMINAL_NAMES.has(lowerProcess)) {
    return '개발';
  }

  // Communication apps
  if (['slack', 'discord', 'teams', 'zoom', 'kakaotalk', 'kakaowork'].includes(lowerProcess)) {
    return '커뮤니케이션';
  }

  // Document apps
  if (['notion', 'winword', 'excel', 'powerpnt', 'onenote', 'acrobat'].includes(lowerProcess)) {
    return '문서';
  }

  // Browsers — classify by window title content
  if (BROWSER_NAMES.has(lowerProcess)) {
    if (DEV_KEYWORDS.some(kw => lowerTitle.includes(kw))) return '개발';
    if (SNS_KEYWORDS.some(kw => lowerTitle.includes(kw))) return 'SNS';
    if (COMM_KEYWORDS.some(kw => lowerTitle.includes(kw))) return '커뮤니케이션';
    if (DOC_KEYWORDS.some(kw => lowerTitle.includes(kw))) return '문서';
    return '기타';
  }

  return '기타';
}

// Process name → user-friendly display name
const PROCESS_DISPLAY_NAMES = {
  // 브라우저
  'chrome': 'Chrome', 'msedge': 'Edge', 'firefox': 'Firefox',
  'brave': 'Brave', 'opera': 'Opera', 'vivaldi': 'Vivaldi',
  // 개발 도구
  'Code': 'Visual Studio Code', 'WindowsTerminal': '터미널',
  'powershell': 'PowerShell', 'pwsh': 'PowerShell',
  'cmd': '명령 프롬프트', 'bash': 'Bash', 'mintty': 'Git Bash',
  // 커뮤니케이션
  'KakaoWork': '카카오워크', 'KakaoTalk': '카카오톡',
  'slack': 'Slack', 'discord': 'Discord',
  'Teams': 'Microsoft Teams', 'Zoom': 'Zoom',
  // 문서/생산성
  'notion': 'Notion', 'Obsidian': 'Obsidian',
  'WINWORD': 'Word', 'EXCEL': 'Excel',
  'POWERPNT': 'PowerPoint', 'ONENOTE': 'OneNote',
  // Windows 시스템
  'explorer': '파일 탐색기',
  'ShellExperienceHost': 'Windows 앱 (계산기 등)',
  'ApplicationFrameHost': 'Windows 앱',
  'SearchHost': 'Windows 검색',
  'SystemSettings': '설정',
  'Taskmgr': '작업 관리자',
  // 기타
  'electron': 'Electron 앱',
  'Notepad': '메모장', 'mspaint': '그림판',
  'picpick': 'PicPick', 'claude': 'Claude',
};

function getDisplayName(processName) {
  return PROCESS_DISPLAY_NAMES[processName] || processName;
}

module.exports = { parseTitle, categorizeByTitle, getDisplayName };
