let trendChart = null;

async function renderTrend(container, date) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h2>📈 트렌드</h2>
      <div class="date-nav">
        <button id="trend-prev-week">&lt; 이전 주</button>
        <span class="current-date" id="trend-week-label"></span>
        <button id="trend-next-week">다음 주 &gt;</button>
      </div>
    </div>

    <div class="chart-container">
      <h3>주간 집중 점수</h3>
      <div class="chart-wrapper" style="height:200px">
        <canvas id="trend-chart"></canvas>
      </div>
    </div>

    <div class="stats-row" id="trend-stats">
      <div class="stat-card">
        <div class="label">주간 평균 점수</div>
        <div class="value" id="t-avg-score">-</div>
      </div>
      <div class="stat-card">
        <div class="label">주간 총 활동</div>
        <div class="value" id="t-total-time">-</div>
      </div>
      <div class="stat-card">
        <div class="label">최고 점수 날</div>
        <div class="value" id="t-best-day" style="font-size:16px">-</div>
      </div>
    </div>

    <div class="journal-section" id="weekly-report-section">
      <div class="flex-between mb-12">
        <h3>주간 AI 리포트</h3>
        <button class="btn" id="generate-weekly-btn">리포트 생성</button>
      </div>
      <div class="ai-summary-box" id="weekly-report-content">
        <div class="empty-state">
          <div class="icon">📋</div>
          <p>"리포트 생성" 버튼을 클릭하세요.</p>
        </div>
      </div>
    </div>
  `;

  // Week navigation state
  let weekEndDate = date;
  const weekEnd = new Date(weekEndDate + 'T00:00:00');

  function updateWeekLabel() {
    const end = new Date(weekEndDate + 'T00:00:00');
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    document.getElementById('trend-week-label').textContent =
      `${start.getMonth()+1}/${start.getDate()} ~ ${end.getMonth()+1}/${end.getDate()}`;
  }

  document.getElementById('trend-prev-week').addEventListener('click', () => {
    const d = new Date(weekEndDate + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    weekEndDate = d.toISOString().split('T')[0];
    loadWeekData();
  });

  document.getElementById('trend-next-week').addEventListener('click', () => {
    const d = new Date(weekEndDate + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    weekEndDate = d.toISOString().split('T')[0];
    loadWeekData();
  });

  document.getElementById('generate-weekly-btn').addEventListener('click', async () => {
    const btn = document.getElementById('generate-weekly-btn');
    const content = document.getElementById('weekly-report-content');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 생성 중...';

    const result = await window.api.generateWeeklyReport(weekEndDate);
    if (result.error) {
      content.innerHTML = `<p style="color:#ea4335">${esc(result.error)}</p>`;
    } else {
      const r = result.report;
      content.innerHTML = `
        <p><strong>${esc(r.weekly_summary || '')}</strong></p>
        ${r.best_day ? `<p>🏆 ${esc(r.best_day)}</p>` : ''}
        ${r.trend ? `<p>📊 ${esc(r.trend)}</p>` : ''}
        ${r.next_week_suggestion ? `<p>💡 ${esc(r.next_week_suggestion)}</p>` : ''}
      `;
    }
    btn.disabled = false;
    btn.textContent = '리포트 생성';
  });

  async function loadWeekData() {
    updateWeekLabel();
    const weekly = await window.api.getWeeklyStats(weekEndDate);

    // Stats
    document.getElementById('t-avg-score').innerHTML = weekly.avgScore !== null
      ? `${weekly.avgScore}<span class="unit">점</span>`
      : '<span style="font-size:14px;color:var(--text-secondary)">-</span>';
    document.getElementById('t-total-time').innerHTML = formatTimeHtml(weekly.totalSec);

    const best = weekly.days.filter(d => d.focusScore !== null)
      .sort((a, b) => b.focusScore - a.focusScore)[0];
    document.getElementById('t-best-day').textContent = best
      ? `${formatDate(best.date)} (${best.focusScore}점)`
      : '-';

    // Chart
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const labels = weekly.days.map(d => {
      const dt = new Date(d.date + 'T00:00:00');
      return `${dt.getMonth()+1}/${dt.getDate()} (${dayNames[dt.getDay()]})`;
    });
    const scores = weekly.days.map(d => d.focusScore);

    if (trendChart) trendChart.destroy();
    const ctx = document.getElementById('trend-chart').getContext('2d');
    trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: scores,
          backgroundColor: scores.map(s => s !== null ? '#4285f4' : 'rgba(255,255,255,0.05)'),
          borderRadius: 6,
          barThickness: 32
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.raw !== null ? `${ctx.raw}점` : '데이터 없음'
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#9aa0a6', callback: v => `${v}점` }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#e8eaed', font: { size: 11 } }
          }
        }
      }
    });
  }

  loadWeekData();
}
