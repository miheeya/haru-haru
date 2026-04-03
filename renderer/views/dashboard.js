let dashboardChart = null;

async function renderDashboard(container, date) {
  const today = toLocalDateStr(new Date());
  const isToday = date >= today;

  container.innerHTML = `
    <div class="dashboard-header">
      <h2>대시보드</h2>
      <div class="date-nav" role="navigation" aria-label="날짜 이동">
        <button data-nav="prev" data-view="dashboard" aria-label="이전 날짜">&lt;</button>
        <span class="current-date" aria-live="polite">${formatDate(date)}</span>
        <button data-nav="next" data-view="dashboard" aria-label="다음 날짜" ${isToday ? 'disabled' : ''}>&gt;</button>
      </div>
    </div>
    <div class="stats-row" id="stats-row">
      <div class="stat-card" role="group" aria-label="총 사용 시간">
        <h4 class="label" id="label-total-time">총 사용 시간</h4>
        <div class="value" id="total-time" aria-labelledby="label-total-time">-</div>
      </div>
      <div class="stat-card" role="group" aria-label="사용한 앱 수">
        <h4 class="label" id="label-app-count">사용한 앱 수</h4>
        <div class="value" id="app-count" aria-labelledby="label-app-count">-</div>
      </div>
      <div class="stat-card" role="group" aria-label="가장 많이 사용한 앱">
        <h4 class="label" id="label-top-app">가장 많이 사용</h4>
        <div class="value" id="top-app" style="font-size:18px" aria-labelledby="label-top-app">-</div>
      </div>
    </div>
    <div class="chart-container">
      <h3>앱별 사용 시간</h3>
      <div class="chart-wrapper">
        <canvas id="usage-chart" aria-label="앱별 사용 시간 막대 그래프" role="img"></canvas>
      </div>
    </div>
    <div class="manual-entry-card">
      <div class="flex-between mb-12">
        <h3>직접 입력</h3>
        <span class="save-indicator" id="manual-save-status" aria-live="polite">추가됨!</span>
      </div>
      <form id="manual-entry-form" class="manual-entry-form" aria-label="활동 직접 입력">
        <label for="manual-app" class="sr-only">앱/사이트 이름</label>
        <input type="text" id="manual-app" placeholder="앱/사이트 이름 (예: Notion)" required>
        <label for="manual-title" class="sr-only">상세 내용</label>
        <input type="text" id="manual-title" placeholder="상세 내용 (예: 프로젝트 기획서 작성)">
        <div class="duration-input">
          <label for="manual-hours" class="sr-only">시간</label>
          <input type="number" id="manual-hours" min="0" max="23" value="0" aria-label="시간">
          <span class="duration-label" aria-hidden="true">시간</span>
          <label for="manual-minutes" class="sr-only">분</label>
          <input type="number" id="manual-minutes" min="0" max="59" value="30" aria-label="분">
          <span class="duration-label" aria-hidden="true">분</span>
        </div>
        <button type="submit" class="btn">추가</button>
      </form>
    </div>
    <div class="activity-table" id="activity-table" role="list" aria-label="앱별 사용 내역">
      <div class="flex-between" style="padding: 20px 24px 12px">
        <h3 style="padding:0">상세 내역</h3>
        <span style="font-size:12px; color:var(--text-secondary)">항목을 클릭하거나 Enter를 눌러 상세 내역 표시</span>
      </div>
    </div>
    <div id="idle-gaps-section"></div>
  `;

  // Manual entry form — restore draft from localStorage
  const draftKey = 'manual-entry-draft';
  const draft = JSON.parse(localStorage.getItem(draftKey) || '{}');
  if (draft.app) document.getElementById('manual-app').value = draft.app;
  if (draft.title) document.getElementById('manual-title').value = draft.title;
  if (draft.hours) document.getElementById('manual-hours').value = draft.hours;
  if (draft.minutes) document.getElementById('manual-minutes').value = draft.minutes;

  // Auto-save draft on input
  function saveDraft() {
    localStorage.setItem(draftKey, JSON.stringify({
      app: document.getElementById('manual-app').value,
      title: document.getElementById('manual-title').value,
      hours: document.getElementById('manual-hours').value,
      minutes: document.getElementById('manual-minutes').value
    }));
  }
  document.getElementById('manual-app').addEventListener('input', saveDraft);
  document.getElementById('manual-title').addEventListener('input', saveDraft);
  document.getElementById('manual-hours').addEventListener('input', saveDraft);
  document.getElementById('manual-minutes').addEventListener('input', saveDraft);

  document.getElementById('manual-entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const appName = document.getElementById('manual-app').value.trim();
    const title = document.getElementById('manual-title').value.trim() || appName;
    const hours = parseInt(document.getElementById('manual-hours').value) || 0;
    const minutes = parseInt(document.getElementById('manual-minutes').value) || 0;
    const totalMin = hours * 60 + minutes;

    if (!appName || totalMin <= 0) return;

    await window.api.addManualActivity(date, appName, title, totalMin);

    // Clear draft
    localStorage.removeItem(draftKey);

    // Show confirmation
    const indicator = document.getElementById('manual-save-status');
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);

    // Reset form and refresh
    document.getElementById('manual-app').value = '';
    document.getElementById('manual-title').value = '';
    document.getElementById('manual-hours').value = '0';
    document.getElementById('manual-minutes').value = '30';

    switchView('dashboard');
  });

  // Fetch data
  const [data, idleGaps, settings] = await Promise.all([
    window.api.getDaySummary(date),
    window.api.getIdleGaps(date),
    window.api.getSettings()
  ]);
  const idleThresholdMin = Math.round((parseInt(settings.idle_threshold_sec) || 300) / 60);

  // Render idle gaps
  renderIdleGaps(idleGaps, idleThresholdMin);

  if (!data.apps || data.apps.length === 0) {
    document.getElementById('total-time').textContent = '0m';
    document.getElementById('app-count').textContent = '0';
    document.getElementById('top-app').textContent = '-';
    document.getElementById('activity-table').innerHTML += `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>이 날짜에 기록된 활동이 없습니다.</p>
      </div>
    `;
    return;
  }

  // Stats
  const totalHours = Math.floor(data.totalSec / 3600);
  const totalMins = Math.floor((data.totalSec % 3600) / 60);
  document.getElementById('total-time').innerHTML =
    totalHours > 0
      ? `${totalHours}<span class="unit">h</span> ${totalMins}<span class="unit">m</span>`
      : `${totalMins}<span class="unit">m</span>`;
  document.getElementById('app-count').textContent = data.apps.length;
  document.getElementById('top-app').textContent = data.apps[0].displayName;

  // Chart
  const top10 = data.apps.slice(0, 10);
  const colors = [
    '#4285f4', '#34a853', '#fbbc04', '#ea4335', '#9c27b0',
    '#00bcd4', '#ff9800', '#795548', '#607d8b', '#e91e63'
  ];

  if (dashboardChart) {
    dashboardChart.destroy();
  }

  const ctx = document.getElementById('usage-chart').getContext('2d');
  dashboardChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(a => a.displayName),
      datasets: [{
        data: top10.map(a => Math.round(a.totalSec / 60)),
        backgroundColor: colors.slice(0, top10.length),
        borderRadius: 6,
        barThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const mins = ctx.raw;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#9aa0a6',
            callback: (v) => {
              const h = Math.floor(v / 60);
              return h > 0 ? `${h}h` : `${v}m`;
            }
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e8eaed', font: { size: 13 } }
        }
      }
    }
  });

  // Table with accordion details
  const tableEl = document.getElementById('activity-table');
  for (const appItem of data.apps) {
    const rowWrapper = document.createElement('div');
    rowWrapper.className = 'table-row-wrapper';

    const row = document.createElement('div');
    row.className = 'table-row table-row-expandable';
    row.setAttribute('role', 'listitem');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-expanded', 'false');
    row.setAttribute('aria-label', `${appItem.displayName}, ${formatTime(appItem.totalSec)}, ${appItem.percentage}%`);
    row.innerHTML = `
      <div>
        <span class="expand-arrow" aria-hidden="true">▶</span>
        <span class="app-name">${esc(appItem.displayName)}</span>
        <div class="progress-bar" role="progressbar" aria-valuenow="${appItem.percentage}" aria-valuemin="0" aria-valuemax="100" aria-label="${appItem.displayName} ${appItem.percentage}%"><div class="fill" style="width: ${appItem.percentage}%"></div></div>
      </div>
      <div class="time">${formatTime(appItem.totalSec)}</div>
      <div class="pct-cell">
        <span class="pct">${appItem.percentage}%</span>
        <button class="delete-btn" aria-label="${appItem.displayName} 삭제">&times;</button>
      </div>
    `;

    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'details-container';
    detailsContainer.style.display = 'none';

    let expanded = false;
    let cachedDetails = null;

    // Delete button
    row.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`"${appItem.displayName}" 항목의 오늘 기록을 모두 삭제할까요?`)) {
        await window.api.deleteActivity(appItem.name, date);
        switchView('dashboard');
      }
    });

    // Accordion toggle (click + keyboard)
    async function toggleAccordion(e) {
      if (e.target.closest('.delete-btn')) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();

      expanded = !expanded;
      row.classList.toggle('expanded', expanded);
      row.setAttribute('aria-expanded', expanded);
      row.querySelector('.expand-arrow').textContent = expanded ? '▼' : '▶';

      if (expanded) {
        detailsContainer.style.display = 'block';

        if (!cachedDetails) {
          detailsContainer.innerHTML = '<div class="detail-loading"><span class="spinner"></span></div>';
          cachedDetails = await window.api.getAppDetails(date, appItem.name);
        }
        detailsContainer.innerHTML = '';
        const result = cachedDetails;

        let maxShow = 10;
        let showAll = false;

        function renderDetails() {
          detailsContainer.innerHTML = '';
          const shown = showAll ? result.details : result.details.slice(0, maxShow);
          const rest = showAll ? [] : result.details.slice(maxShow);

          shown.forEach((d, i) => {
            const isLast = i === shown.length - 1 && rest.length === 0;
          const detailRow = document.createElement('div');
          detailRow.className = 'detail-row';

          const editBtn = d.isManual
            ? `<button class="edit-btn" data-id="${d.id}" data-sec="${d.totalSec}" title="시간 수정">✎</button>`
            : '';
          const manualTag = d.isManual ? '<span class="manual-tag">직접</span>' : '';

          detailRow.innerHTML = `
            <div class="detail-label">
              <span class="tree-branch">${isLast ? '└' : '├'}</span>
              ${manualTag}
              <span class="detail-text" title="${esc(d.title)}">${esc(d.label)}</span>
            </div>
            <div class="detail-time-cell">
              <span class="detail-time">${formatTime(d.totalSec)}</span>
              ${editBtn}
            </div>
          `;

          // Edit handler for manual entries
          const btn = detailRow.querySelector('.edit-btn');
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const timeCell = detailRow.querySelector('.detail-time-cell');
              const curSec = parseInt(btn.dataset.sec);
              const curH = Math.floor(curSec / 3600);
              const curM = Math.floor((curSec % 3600) / 60);

              timeCell.innerHTML = `
                <div class="inline-edit">
                  <input type="number" class="edit-hours" value="${curH}" min="0" max="23">
                  <span>h</span>
                  <input type="number" class="edit-minutes" value="${curM}" min="0" max="59">
                  <span>m</span>
                  <button class="edit-save" title="저장">✓</button>
                  <button class="edit-cancel" title="취소">✕</button>
                </div>
              `;

              timeCell.querySelector('.edit-hours').focus();

              timeCell.querySelector('.edit-save').addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const h = parseInt(timeCell.querySelector('.edit-hours').value) || 0;
                const m = parseInt(timeCell.querySelector('.edit-minutes').value) || 0;
                const totalMin = h * 60 + m;
                if (totalMin <= 0) return;
                await window.api.updateManualActivity(parseInt(btn.dataset.id), totalMin);
                cachedDetails = null;
                switchView('dashboard');
              });

              timeCell.querySelector('.edit-cancel').addEventListener('click', (ev) => {
                ev.stopPropagation();
                timeCell.innerHTML = `
                  <span class="detail-time">${formatTime(curSec)}</span>
                  ${editBtn}
                `;
              });
            });
          }

          detailsContainer.appendChild(detailRow);
        });

          if (rest.length > 0) {
            const restSec = rest.reduce((sum, d) => sum + d.totalSec, 0);
            const restRow = document.createElement('div');
            restRow.className = 'detail-row detail-row-expand';
            restRow.setAttribute('tabindex', '0');
            restRow.setAttribute('role', 'button');
            restRow.setAttribute('aria-label', `나머지 ${rest.length}건 더 보기`);
            restRow.innerHTML = `
              <div class="detail-label">
                <span class="tree-branch">└</span>
                <span class="detail-text expand-more">▶ 나머지 ${rest.length}건 더 보기</span>
              </div>
              <div class="detail-time">${formatTime(restSec)}</div>
            `;
            function expandRest(ev) {
              ev.stopPropagation();
              if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
              if (ev.type === 'keydown') ev.preventDefault();
              showAll = true;
              renderDetails();
            }
            restRow.addEventListener('click', expandRest);
            restRow.addEventListener('keydown', expandRest);
            detailsContainer.appendChild(restRow);
          } else if (showAll && result.details.length > maxShow) {
            const collapseRow = document.createElement('div');
            collapseRow.className = 'detail-row detail-row-expand';
            collapseRow.setAttribute('tabindex', '0');
            collapseRow.setAttribute('role', 'button');
            collapseRow.setAttribute('aria-label', '접기');
            collapseRow.innerHTML = `
              <div class="detail-label">
                <span class="tree-branch">└</span>
                <span class="detail-text expand-more">▲ 접기</span>
              </div>
              <div class="detail-time"></div>
            `;
            function collapseDetails(ev) {
              ev.stopPropagation();
              if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
              if (ev.type === 'keydown') ev.preventDefault();
              showAll = false;
              renderDetails();
            }
            collapseRow.addEventListener('click', collapseDetails);
            collapseRow.addEventListener('keydown', collapseDetails);
            detailsContainer.appendChild(collapseRow);
          }
        }

        renderDetails();
      } else {
        detailsContainer.style.display = 'none';
      }
    }
    row.addEventListener('click', toggleAccordion);
    row.addEventListener('keydown', toggleAccordion);

    rowWrapper.appendChild(row);
    rowWrapper.appendChild(detailsContainer);
    tableEl.appendChild(rowWrapper);
  }
}

function renderIdleGaps(gaps, thresholdMin = 10) {
  const section = document.getElementById('idle-gaps-section');
  if (!gaps || gaps.length === 0) {
    section.innerHTML = '';
    return;
  }

  const totalIdleSec = gaps.reduce((s, g) => s + g.durationSec, 0);

  const rows = gaps.map(g => {
    const start = new Date(g.startTime);
    const end = new Date(g.endTime);
    const startStr = start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const endStr = end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="idle-gap-row">
        <span class="idle-gap-time">${startStr} ~ ${endStr}</span>
        <span class="idle-gap-duration">${formatTime(g.durationSec)}</span>
      </div>
    `;
  }).join('');

  section.innerHTML = `
    <div class="idle-gaps-card">
      <div class="flex-between mb-12">
        <h3>자리비움 (${thresholdMin}분 이상)</h3>
        <span class="idle-gap-total">총 ${formatTime(totalIdleSec)}</span>
      </div>
      ${rows}
    </div>
  `;
}
