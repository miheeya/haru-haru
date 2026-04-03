async function renderSettings(container) {
  const settings = await window.api.getSettings();

  container.innerHTML = `
    <h2 style="margin-bottom: 24px">설정</h2>

    <div class="settings-group">
      <h3>추적 설정</h3>
      <div class="setting-item">
        <div>
          <h4 class="setting-label">폴링 간격 (초)</h4>
          <div class="setting-desc">활성 창을 확인하는 간격. 작을수록 정확하지만 리소스를 더 사용합니다.</div>
        </div>
        <input type="number" id="setting-poll-interval" value="${esc(settings.poll_interval_sec || '3')}" min="1" max="30">
      </div>
      <div class="setting-item">
        <div>
          <h4 class="setting-label">유휴 감지 (분)</h4>
          <div class="setting-desc">이 시간 동안 변화가 없으면 유휴 상태로 간주합니다.</div>
        </div>
        <input type="number" id="setting-idle-threshold" value="${Math.round((parseInt(settings.idle_threshold_sec) || 300) / 60)}" min="1" max="60">
      </div>
    </div>

    <div style="margin-top: 16px">
      <button class="btn" id="save-settings-btn">설정 저장</button>
      <span class="save-indicator" id="settings-save-status" style="margin-left: 12px">저장됨</span>
    </div>

    <div class="settings-group" style="margin-top: 32px;">
      <h3>데이터 내보내기</h3>
      <div class="setting-item">
        <div>
          <h4 class="setting-label">CSV로 내보내기</h4>
          <div class="setting-desc">활동 로그 상세와 날짜별 요약을 CSV 파일로 저장합니다. 엑셀이나 구글 시트에서 열 수 있습니다.</div>
        </div>
        <button class="btn" id="export-data-btn" style="white-space: nowrap;">내보내기</button>
      </div>
    </div>

    <div class="settings-group" style="margin-top: 16px;">
      <h3>데이터 초기화</h3>
      <div class="setting-item">
        <div>
          <h4 class="setting-label">모든 활동 기록 삭제</h4>
          <div class="setting-desc">활동 로그, 업무 일지, 할 일, 통계가 모두 삭제됩니다. 설정값은 유지됩니다. 이 작업은 되돌릴 수 없습니다.</div>
        </div>
        <button class="btn" id="reset-data-btn" style="background: var(--yellow); color: #1a1d27; white-space: nowrap;">초기화</button>
      </div>
    </div>
  `;

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const newSettings = {
      poll_interval_sec: document.getElementById('setting-poll-interval').value,
      idle_threshold_sec: String(parseInt(document.getElementById('setting-idle-threshold').value) * 60)
    };

    await window.api.saveSettings(newSettings);

    const indicator = document.getElementById('settings-save-status');
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
  });

  document.getElementById('export-data-btn').addEventListener('click', async () => {
    const btn = document.getElementById('export-data-btn');
    btn.disabled = true;
    btn.textContent = '내보내는 중...';

    const result = await window.api.exportData();

    btn.disabled = false;
    btn.textContent = '내보내기';

    if (result.canceled) return;
    if (result.success) {
      alert(`CSV 파일 ${result.fileCount}개가 저장되었습니다.\n${result.dir}`);
    }
  });

  document.getElementById('reset-data-btn').addEventListener('click', async () => {
    if (!confirm('모든 활동 기록, 업무 일지, 할 일, 통계가 삭제됩니다.\n정말 초기화하시겠습니까?')) return;
    if (!confirm('되돌릴 수 없습니다. 정말로 삭제하시겠습니까?')) return;

    await window.api.resetAllData();
    alert('데이터가 초기화되었습니다.');
    switchView('dashboard');
  });
}
