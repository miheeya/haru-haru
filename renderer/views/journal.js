let currentTodos = [];
let nextTodoId = 1;

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
      <h3>오늘의 할 일</h3>
      <div class="todo-list" id="todo-list"></div>
      <div class="todo-progress-wrap" id="todo-progress-wrap" style="display:none">
        <div class="todo-progress-bar"><div class="todo-progress-fill" id="todo-progress-fill"></div></div>
        <span class="todo-progress-text" id="todo-progress-text"></span>
      </div>
    </div>

    <div class="journal-section">
      <div class="flex-between mb-12">
        <h3>하루 회고</h3>
        <span class="save-indicator" id="note-save-status">저장됨</span>
      </div>
      <textarea
        class="journal-textarea"
        id="journal-notes"
        placeholder="오늘 하루를 돌아보며 메모를 남겨보세요..."
      ></textarea>
    </div>
  `;

  // --- Load data ---
  const [journal, todos] = await Promise.all([
    window.api.getJournal(date),
    window.api.getTodos(date)
  ]);

  currentTodos = todos || [];
  nextTodoId = currentTodos.length > 0 ? Math.max(...currentTodos.map(t => t.id)) + 1 : 1;

  if (journal.user_notes) {
    document.getElementById('journal-notes').value = journal.user_notes;
  }

  renderTodoList(date);

  // --- Auto-save notes ---
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

function renderTodoList(date) {
  const listEl = document.getElementById('todo-list');
  listEl.innerHTML = '';

  // Render existing todos
  currentTodos.forEach((todo) => {
    const item = createTodoItem(todo, date);
    listEl.appendChild(item);
  });

  // Add "new todo" input
  const addItem = document.createElement('div');
  addItem.className = 'todo-item todo-add';
  addItem.innerHTML = `
    <span class="todo-checkbox-placeholder">+</span>
    <input type="text" class="todo-input" id="todo-new-input" placeholder="할 일 추가...">
  `;
  listEl.appendChild(addItem);

  const newInput = addItem.querySelector('#todo-new-input');
  newInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && newInput.value.trim()) {
      const text = newInput.value.trim();
      currentTodos.push({ id: nextTodoId++, text, done: false });
      saveTodosAndRender(date);
      // Focus new input after re-render
      setTimeout(() => {
        const el = document.getElementById('todo-new-input');
        if (el) el.focus();
      }, 0);
    }
  });

  updateProgress();
}

function createTodoItem(todo, date) {
  const item = document.createElement('div');
  item.className = 'todo-item' + (todo.done ? ' done' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = todo.done;
  checkbox.addEventListener('change', () => {
    todo.done = checkbox.checked;
    item.classList.toggle('done', todo.done);
    textInput.classList.toggle('todo-done-text', todo.done);
    saveTodosAndRender(date);
  });

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'todo-input' + (todo.done ? ' todo-done-text' : '');
  textInput.value = todo.text;

  let debounce = null;
  textInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (textInput.value.trim() === '') {
        // Delete todo when text is cleared
        currentTodos = currentTodos.filter(t => t.id !== todo.id);
        saveTodosAndRender(date);
      } else {
        todo.text = textInput.value.trim();
        window.api.saveTodos(date, currentTodos);
      }
    }, 500);
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('todo-new-input')?.focus();
    }
  });

  item.appendChild(checkbox);
  item.appendChild(textInput);
  return item;
}

function updateProgress() {
  const wrap = document.getElementById('todo-progress-wrap');
  if (currentTodos.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  const done = currentTodos.filter(t => t.done).length;
  const total = currentTodos.length;
  const pct = Math.round((done / total) * 100);

  document.getElementById('todo-progress-fill').style.width = pct + '%';
  document.getElementById('todo-progress-text').textContent = `${done}/${total} 완료 (${pct}%)`;
}

async function saveTodosAndRender(date) {
  await window.api.saveTodos(date, currentTodos);
  renderTodoList(date);
}
