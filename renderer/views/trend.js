let trendChart = null;

async function renderTrend(container, date) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h2>📈 트렌드</h2>
      <div class="date-nav">
        <button data-nav="trend-prev">&lt; 이전 주</button>
        <span class="current-date" id="trend-week-label"></span>
        <button data-nav="trend-next">다음 주 &gt;</button>
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
  `;

  let weekEndDate = date;

  function updateWeekLabel() {
    const end = new Date(weekEndDate + 'T00:00:00');
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    document.getElementById('trend-week-label').textContent =
      `${start.getMonth()+1}/${start.getDate()} ~ ${end.getMonth()+1}/${end.getDate()}`;
  }

  // Expose trend nav for event delegation in app.js
  window._trendState = {
    prev() {
      const d = new Date(weekEndDate + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      weekEndDate = toLocalDateStr(d);
      loadWeekData();
    },
    next() {
      const d = new Date(weekEndDate + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      weekEndDate = toLocalDateStr(d);
      loadWeekData();
    }
  };

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
