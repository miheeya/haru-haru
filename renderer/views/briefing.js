async function renderBriefing(container, date) {
  const today = toLocalDateStr(new Date());
  const isToday = date === today;

  container.innerHTML = `
    <div class="dashboard-header">
      <h2>☀️ 아침 브리핑</h2>
      <div class="date-nav">
        <button data-nav="prev" data-view="briefing">&lt;</button>
        <span class="current-date">${formatDate(date)}</span>
        <button data-nav="next" data-view="briefing" ${isToday ? 'disabled' : ''}>&gt;</button>
      </div>
    </div>

    <div class="briefing-desc">전날의 활동 데이터를 바탕으로 집중 점수, 카테고리별 시간 배분, 주간 흐름을 한눈에 보여줍니다.</div>

    <div class="stats-row" id="briefing-stats">
      <div class="stat-card">
        <h4 class="label">집중 점수</h4>
        <div class="value" id="b-focus-score">-</div>
        <div class="stat-sub" id="b-focus-sub"></div>
      </div>
      <div class="stat-card">
        <h4 class="label">총 활동 시간</h4>
        <div class="value" id="b-total-time">-</div>
      </div>
      <div class="stat-card">
        <h4 class="label">딥워크</h4>
        <div class="value" id="b-deep-work">-</div>
      </div>
      <div class="stat-card">
        <h4 class="label">앱 수</h4>
        <div class="value" id="b-app-count">-</div>
      </div>
    </div>

    <div class="category-section">
      <h3>카테고리별 시간</h3>
      <div class="category-bar" id="b-category-bar"></div>
      <div class="category-legend" id="b-category-legend"></div>
    </div>

    <div class="chart-container">
      <h3>이번 주 집중 점수</h3>
      <div class="weekly-sparkline" id="b-weekly-sparkline"></div>
    </div>
  `;

  // Load yesterday's stats for display
  const yesterday = new Date(date + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);

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
