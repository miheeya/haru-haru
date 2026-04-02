async function renderJournal(container, date) {
  const today = toLocalDateStr(new Date());
  const isToday = date >= today;

  container.innerHTML = `
    <div class="dashboard-header">
      <h2>업무 일지</h2>
      <div class="date-nav">
        <button data-nav="prev" data-view="journal">&lt;</button>
        <span class="current-date">${formatDate(date)}</span>
        <button data-nav="next" data-view="journal" ${isToday ? 'disabled style="opacity:0.3;cursor:default"' : ''}>&gt;</button>
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

  // Load existing data
  const journal = await window.api.getJournal(date);

  if (journal.user_notes) {
    document.getElementById('journal-notes').value = journal.user_notes;
  }

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
