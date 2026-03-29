async function renderJournal(container, date) {
  container.innerHTML = `
    <div class="dashboard-header">
      <h2>업무 일지</h2>
      <div class="date-nav">
        <button id="journal-prev">&lt;</button>
        <span class="current-date">${formatDate(date)}</span>
        <button id="journal-next">&gt;</button>
      </div>
    </div>

    <div class="journal-section">
      <div class="flex-between mb-12">
        <h3>AI 하루 요약</h3>
        <div>
          <span class="save-indicator" id="summary-status"></span>
          <button class="btn" id="generate-btn">요약 생성</button>
        </div>
      </div>
      <div class="ai-summary-box" id="ai-summary">
        <div class="empty-state">
          <div class="icon">🤖</div>
          <p>아직 요약이 생성되지 않았습니다.<br>"요약 생성" 버튼을 클릭하세요.</p>
        </div>
      </div>
    </div>

    <div class="journal-section">
      <div class="flex-between mb-12">
        <h3>내 메모</h3>
        <span class="save-indicator" id="note-save-status">저장됨</span>
      </div>
      <textarea
        class="journal-textarea"
        id="journal-notes"
        placeholder="오늘 하루를 돌아보며 메모를 남겨보세요..."
      ></textarea>
    </div>
  `;

  // Date navigation
  document.getElementById('journal-prev').addEventListener('click', () => {
    currentDate = prevDate(currentDate);
    switchView('journal');
  });
  document.getElementById('journal-next').addEventListener('click', () => {
    currentDate = nextDate(currentDate);
    switchView('journal');
  });

  // Load existing data
  const journal = await window.api.getJournal(date);

  if (journal.ai_summary) {
    document.getElementById('ai-summary').textContent = journal.ai_summary;
    document.getElementById('ai-summary').classList.remove('empty');
  }

  if (journal.user_notes) {
    document.getElementById('journal-notes').value = journal.user_notes;
  }

  // Generate summary
  document.getElementById('generate-btn').addEventListener('click', async () => {
    const btn = document.getElementById('generate-btn');
    const statusEl = document.getElementById('summary-status');
    const summaryBox = document.getElementById('ai-summary');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>생성 중...';

    const result = await window.api.generateSummary(date);

    if (result.error) {
      statusEl.textContent = result.error;
      statusEl.classList.add('show');
      statusEl.style.color = '#ea4335';
      setTimeout(() => statusEl.classList.remove('show'), 5000);
    } else {
      summaryBox.textContent = result.summary;
      summaryBox.classList.remove('empty');
      statusEl.textContent = '생성 완료!';
      statusEl.style.color = '#34a853';
      statusEl.classList.add('show');
      setTimeout(() => statusEl.classList.remove('show'), 3000);
    }

    btn.disabled = false;
    btn.textContent = '요약 생성';
  });

  // Auto-save notes
  let saveTimeout = null;
  document.getElementById('journal-notes').addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const note = document.getElementById('journal-notes').value;
      await window.api.saveJournalNote(date, note);
      const indicator = document.getElementById('note-save-status');
      indicator.classList.add('show');
      setTimeout(() => indicator.classList.remove('show'), 2000);
    }, 1000);
  });
}
