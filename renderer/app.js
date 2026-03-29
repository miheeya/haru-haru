// HTML escape to prevent XSS
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// Current state
let currentView = 'briefing';
let currentDate = new Date().toISOString().split('T')[0];

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    switchView(view);
  });
});

function switchView(view) {
  currentView = view;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
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
  return d.toISOString().split('T')[0];
}

function nextDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
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
  const text = el.querySelector('span');
  dot.classList.toggle('active', isTracking);
  text.textContent = isTracking ? '추적 중' : '일시정지';
}

document.getElementById('tracking-status').addEventListener('click', async () => {
  await window.api.toggleTracking();
  updateTrackingStatus();
});

// Init
updateTrackingStatus();
switchView('briefing');

// Auto-refresh dashboard every 30s (skip if user is typing)
setInterval(() => {
  const active = document.activeElement;
  const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  if (currentView === 'dashboard' && !isTyping) {
    switchView('dashboard');
  }
  updateTrackingStatus();
}, 30000);
