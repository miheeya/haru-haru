// HTML escape to prevent XSS (no DOM allocation)
function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Local date helper (avoids UTC shift from toISOString)
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Current state
let currentView = 'briefing';
let currentDate = toLocalDateStr(new Date());
let lastSummaryJson = '';

// Navigation — click + keyboard (Enter/Space)
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switchView(item.dataset.view);
    }
  });
});

function switchView(view) {
  currentView = view;
  lastSummaryJson = ''; // reset stale cache on view switch

  // Update nav + aria-selected
  document.querySelectorAll('.nav-item').forEach(el => {
    const isActive = el.dataset.view === view;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', isActive);
  });

  // Render view
  const content = document.getElementById('content');
  switch (view) {
    case 'briefing':
      renderBriefing(content, currentDate);
      break;
    case 'dashboard':
      renderDashboard(content, currentDate);
      break;
    case 'journal':
      renderJournal(content, currentDate);
      break;
    case 'trend':
      renderTrend(content, currentDate);
      break;
    case 'settings':
      renderSettings(content);
      break;
    case 'help':
      renderHelp(content);
      break;
  }
}

// Date helpers
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${days[d.getDay()]})`;
}

function prevDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return toLocalDateStr(d);
}

function nextDate(dateStr) {
  const today = toLocalDateStr(new Date());
  if (dateStr >= today) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

function formatTime(totalSec) {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Tracking status
async function updateTrackingStatus() {
  const { isTracking } = await window.api.getTrackingStatus();
  const el = document.getElementById('tracking-status');
  const dot = el.querySelector('.status-dot');
  const textEl = el.querySelectorAll('span')[1];
  dot.classList.toggle('active', isTracking);
  const label = isTracking ? '추적 중' : '일시정지';
  textEl.textContent = label;
  el.setAttribute('aria-label', `추적 상태: ${label}. 클릭하여 토글`);
}

document.getElementById('tracking-status').addEventListener('click', async () => {
  await window.api.toggleTracking();
  updateTrackingStatus();
});

// Date navigation — single event delegation handler for ALL views
document.getElementById('content').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-nav]');
  if (!btn || btn.disabled) return;

  const navAction = btn.dataset.nav;
  const view = btn.dataset.view;

  if (navAction === 'prev' && view) {
    currentDate = prevDate(currentDate);
    switchView(view);
  } else if (navAction === 'next' && view) {
    currentDate = nextDate(currentDate);
    switchView(view);
  } else if (navAction === 'today' && view) {
    currentDate = toLocalDateStr(new Date());
    switchView(view);
  } else if (navAction === 'trend-prev' && window._trendState) {
    window._trendState.prev();
  } else if (navAction === 'trend-next' && window._trendState) {
    window._trendState.next();
  }
});

// Init
updateTrackingStatus();
switchView('briefing');

// Auto-refresh: only update stats text, not full re-render

async function softRefreshDashboard() {
  const today = toLocalDateStr(new Date());
  if (currentDate !== today) return;

  try {
    const data = await window.api.getDaySummary(currentDate);
    const newJson = JSON.stringify(data);
    if (newJson === lastSummaryJson) return;
    lastSummaryJson = newJson;

    const totalTimeEl = document.getElementById('total-time');
    const appCountEl = document.getElementById('app-count');
    const topAppEl = document.getElementById('top-app');
    if (!totalTimeEl) return;

    if (data.apps && data.apps.length > 0) {
      const totalHours = Math.floor(data.totalSec / 3600);
      const totalMins = Math.floor((data.totalSec % 3600) / 60);
      totalTimeEl.innerHTML = totalHours > 0
        ? `${totalHours}<span class="unit">h</span> ${totalMins}<span class="unit">m</span>`
        : `${totalMins}<span class="unit">m</span>`;
      appCountEl.textContent = data.apps.length;
      topAppEl.textContent = data.apps[0].name;
    }
  } catch {}
}

setInterval(() => {
  if (currentView === 'dashboard') {
    softRefreshDashboard();
  }
  updateTrackingStatus();
}, 30000);
