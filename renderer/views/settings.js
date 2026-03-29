async function renderSettings(container) {
  const settings = await window.api.getSettings();

  container.innerHTML = `
    <h2 style="margin-bottom: 24px">설정</h2>

    <div class="settings-group">
      <h3>Claude API</h3>
      <div class="setting-item">
        <div>
          <div class="setting-label">API 키</div>
          <div class="setting-desc">AI 요약 생성에 사용됩니다. Anthropic Console에서 발급받으세요.</div>
        </div>
        <input type="password" id="setting-api-key" value="${esc(settings.api_key || '')}" placeholder="sk-ant-...">
      </div>
    </div>

    <div class="settings-group">
      <h3>추적 설정</h3>
      <div class="setting-item">
        <div>
          <div class="setting-label">폴링 간격 (초)</div>
          <div class="setting-desc">활성 창을 확인하는 간격. 작을수록 정확하지만 리소스를 더 사용합니다.</div>
        </div>
        <input type="number" id="setting-poll-interval" value="${esc(settings.poll_interval_sec || '3')}" min="1" max="30">
      </div>
      <div class="setting-item">
        <div>
          <div class="setting-label">유휴 감지 (초)</div>
          <div class="setting-desc">이 시간 동안 변화가 없으면 유휴 상태로 간주합니다.</div>
        </div>
        <input type="number" id="setting-idle-threshold" value="${esc(settings.idle_threshold_sec || '300')}" min="60" max="3600">
      </div>
    </div>

    <div style="margin-top: 16px">
      <button class="btn" id="save-settings-btn">설정 저장</button>
      <span class="save-indicator" id="settings-save-status" style="margin-left: 12px">저장됨</span>
    </div>
  `;

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const newSettings = {
      api_key: document.getElementById('setting-api-key').value,
      poll_interval_sec: document.getElementById('setting-poll-interval').value,
      idle_threshold_sec: document.getElementById('setting-idle-threshold').value
    };

    await window.api.saveSettings(newSettings);

    const indicator = document.getElementById('settings-save-status');
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
  });
}
