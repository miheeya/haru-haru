async function renderBriefing(container, date) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h2>☀️ 좋은 아침이에요</h2>
      <div class="date-nav">
        <button id="briefing-prev">&lt;</button>
        <span class="current-date">${formatDate(date)}</span>
        <button id="briefing-next">&gt;</button>
      </div>
    </div>

    <div class="briefing-card" id="briefing-card">
      <div class="briefing-label">🤖 AI 브리핑</div>
      <div class="briefing-text" id="briefing-text">
        <span class="spinner"></span> 브리핑 생성 중...
      </div>
    </div>

    <div class="stats-row" id="briefing-stats">
      <div class="stat-card">
        <div class="label">집중 점수</div>
        <div class="value" id="b-focus-score">-</div>
        <div class="stat-sub" id="b-focus-sub"></div>
      </div>
      <div class="stat-card">
        <div class="label">총 활동 시간</div>
        <div class="value" id="b-total-time">-</div>
      </div>
      <div class="stat-card">
        <div class="label">딥워크</div>
        <div class="value" id="b-deep-work">-</div>
      </div>
      <div class="stat-card">
        <div class="label">앱 수</div>
        <div class="value" id="b-app-count">-</div>
      </div>
    </div>

    <div class="category-section">
      <h3>카테고리별 시간</h3>
      <div class="category-bar" id="b-category-bar"></div>
      <div class="category-legend" id="b-category-legend"></div>
    </div>

    <div class="insights-row" id="b-insights"></div>

    <div class="chart-container">
      <h3>이번 주 집중 점수</h3>
      <div class="weekly-sparkline" id="b-weekly-sparkline"></div>
    </div>
  `;

  // Date nav
  document.getElementById('briefing-prev').addEventListener('click', () => {
    currentDate = prevDate(currentDate);
    switchView('briefing');
  });
  document.getElementById('briefing-next').addEventListener('click', () => {
    currentDate = nextDate(currentDate);
    switchView('briefing');
  });

  // Load yesterday's stats for display
  const yesterday = new Date(date + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const [stats, daySummary, weeklyData] = await Promise.all([
    window.api.getDailyStats(yesterdayStr),
    window.api.getDaySummary(yesterdayStr),
    window.api.getWeeklyStats(yesterdayStr)
  ]);

  // Focus score
  const focusEl = document.getElementById('b-focus-score');
  if (stats.focusScore !== null) {
    focusEl.innerHTML = `${stats.focusScore}<span class="unit">점</span>`;
  } else {
    focusEl.innerHTML = '<span style="font-size:14px;color:var(--text-secondary)">데이터 부족</span>';
  }

  // Total time
  document.getElementById('b-total-time').innerHTML = formatTimeHtml(stats.totalSec);

  // Deep work
  document.getElementById('b-deep-work').innerHTML = formatTimeHtml(stats.deepWorkSec || 0);

  // App count
  document.getElementById('b-app-count').textContent = daySummary.apps ? daySummary.apps.length : 0;

  // Category bar
  renderCategoryBar(stats.breakdown || {}, stats.totalSec);

  // Weekly sparkline
  renderWeeklySparkline(weeklyData);

  // Load AI briefing (may take a few seconds on first call)
  loadBriefing(date, stats);
}

function formatTimeHtml(totalSec) {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) {
    return `${hours}<span class="unit">h</span> ${minutes}<span class="unit">m</span>`;
  }
  return `${minutes}<span class="unit">m</span>`;
}

const CATEGORY_COLORS = {
  '개발': '#4285f4',
  '문서': '#34a853',
  '커뮤니케이션': '#fbbc04',
  'SNS': '#ea4335',
  '기타': '#607d8b'
};

function renderCategoryBar(breakdown, totalSec) {
  const bar = document.getElementById('b-category-bar');
  const legend = document.getElementById('b-category-legend');

  if (!totalSec || totalSec === 0) {
    bar.innerHTML = '<div style="width:100%;background:#333;height:100%;border-radius:8px"></div>';
    legend.innerHTML = '<span style="color:var(--text-secondary)">데이터 없음</span>';
    return;
  }

  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  bar.innerHTML = sorted.map(([cat, sec]) => {
    const pct = Math.max(Math.round((sec / totalSec) * 100), 1);
    const color = CATEGORY_COLORS[cat] || '#607d8b';
    return `<div style="width:${pct}%;background:${color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:rgba(0,0,0,0.7)">${pct > 5 ? `${esc(cat)} ${pct}%` : ''}</div>`;
  }).join('');

  legend.innerHTML = sorted.map(([cat, sec]) => {
    const color = CATEGORY_COLORS[cat] || '#607d8b';
    return `<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${color};margin-right:4px;vertical-align:middle"></span>${esc(cat)} ${formatTime(sec)}</span>`;
  }).join(' ');
}

function renderWeeklySparkline(weeklyData) {
  const container = document.getElementById('b-weekly-sparkline');
  if (!weeklyData || !weeklyData.days) {
    container.innerHTML = '<span style="color:var(--text-secondary)">데이터 없음</span>';
    return;
  }

  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const maxScore = Math.max(...weeklyData.days.map(d => d.focusScore || 0), 1);

  container.innerHTML = `<div class="sparkline">${weeklyData.days.map((d, i) => {
    const score = d.focusScore;
    const height = score !== null ? Math.max(Math.round((score / 100) * 60), 4) : 4;
    const color = i === weeklyData.days.length - 1 ? '#8ab4f8' : '#4285f4';
    const bgColor = score === null ? 'rgba(255,255,255,0.1)' : color;
    const dayLabel = new Date(d.date + 'T00:00:00').getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `<div class="spark-day">
      <div class="spark-score" style="color:${score !== null ? '#8ab4f8' : '#9aa0a6'}">${score !== null ? score : '—'}</div>
      <div class="spark-bar" style="height:${height}px;background:${bgColor}"></div>
      <div class="spark-label">${dayNames[dayLabel]}</div>
    </div>`;
  }).join('')}</div>
  ${weeklyData.avgScore !== null ? `<div style="margin-top:12px;font-size:13px;color:var(--text-secondary)">주간 평균: <span style="color:#8ab4f8;font-weight:600">${weeklyData.avgScore}점</span></div>` : ''}`;
}

async function loadBriefing(date, stats) {
  const textEl = document.getElementById('briefing-text');
  const insightsEl = document.getElementById('b-insights');

  try {
    const result = await window.api.getMorningBriefing(date);
    if (result.error) {
      textEl.innerHTML = `<span style="color:#ea4335">${esc(result.error)}</span>
        <button class="btn" style="margin-left:12px" onclick="loadBriefing('${date}')">다시 시도</button>`;
      return;
    }

    const b = result.briefing;
    textEl.innerHTML = esc(b.summary || '요약 없음');

    // Insight cards
    const cards = [];
    if (b.pattern) {
      cards.push(`<div class="insight-card">
        <div class="insight-icon">📊</div>
        <div class="insight-title">어제 패턴</div>
        <div class="insight-body">${esc(b.pattern)}</div>
      </div>`);
    }
    if (b.suggestion) {
      cards.push(`<div class="insight-card">
        <div class="insight-icon">💡</div>
        <div class="insight-title">오늘 제안</div>
        <div class="insight-body">${esc(b.suggestion)}</div>
      </div>`);
    }
    if (cards.length > 0) {
      insightsEl.innerHTML = cards.join('');
    }
  } catch (err) {
    textEl.innerHTML = `<span style="color:var(--text-secondary)">브리핑을 불러올 수 없습니다.</span>`;
  }
}
