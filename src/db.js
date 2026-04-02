const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { parseTitle, categorizeByTitle } = require('./title-parser');

let db = null;
let dbPath = null;
let saveTimer = null;

// Local date helper (avoids UTC shift from toISOString)
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function initDB() {
  const SQL = await initSqlJs();
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'haru.db');

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      process_name TEXT NOT NULL,
      window_title TEXT NOT NULL,
      duration_sec INTEGER DEFAULT 3
    )
  `);

  // Add is_manual column for existing DBs (no-op if already exists)
  try { db.run('ALTER TABLE activity_log ADD COLUMN is_manual INTEGER DEFAULT 0'); } catch {}

  db.run(`CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_activity_process ON activity_log(process_name)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_summary (
      date TEXT PRIMARY KEY,
      ai_summary TEXT,
      user_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Default settings
  const defaults = {
    poll_interval_sec: '3',
    idle_threshold_sec: '300'
  };
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run([key, value]);
  }
  insertSetting.free();

  // --- v2 tables ---

  // Categories: process_name + optional title_pattern → category
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_name TEXT NOT NULL,
      title_pattern TEXT,
      category TEXT NOT NULL DEFAULT '기타',
      source TEXT DEFAULT 'auto',
      UNIQUE(process_name, title_pattern)
    )
  `);

  // Daily stats cache (focus score, category breakdown)
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      focus_score INTEGER,
      total_sec INTEGER,
      deep_work_sec INTEGER,
      category_breakdown TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Seed default category rules
  const defaultRules = [
    ['Code', null, '개발'], ['code', null, '개발'],
    ['WindowsTerminal', null, '개발'], ['powershell', null, '개발'],
    ['cmd', null, '개발'], ['bash', null, '개발'], ['mintty', null, '개발'],
    ['slack', null, '커뮤니케이션'], ['discord', null, '커뮤니케이션'],
    ['Teams', null, '커뮤니케이션'], ['Zoom', null, '커뮤니케이션'],
    ['notion', null, '문서'], ['WINWORD', null, '문서'],
    ['EXCEL', null, '문서'], ['POWERPNT', null, '문서'],
    ['chrome', 'GitHub', '개발'], ['chrome', 'Stack Overflow', '개발'],
    ['chrome', 'localhost', '개발'],
    ['chrome', 'YouTube', 'SNS'], ['chrome', 'Twitter', 'SNS'],
    ['chrome', 'Instagram', 'SNS'], ['chrome', 'Facebook', 'SNS'],
    ['chrome', 'Reddit', 'SNS'],
    ['chrome', 'Gmail', '커뮤니케이션'], ['chrome', 'Outlook', '커뮤니케이션'],
    ['chrome', 'Google Docs', '문서'], ['chrome', 'Notion', '문서'],
    ['msedge', 'GitHub', '개발'], ['msedge', 'Stack Overflow', '개발'],
    ['msedge', 'YouTube', 'SNS'], ['msedge', 'Gmail', '커뮤니케이션'],
  ];
  const insertRule = db.prepare(
    'INSERT OR IGNORE INTO categories (process_name, title_pattern, category, source) VALUES (?, ?, ?, ?)'
  );
  for (const [proc, pattern, cat] of defaultRules) {
    insertRule.run([proc, pattern, cat, 'rule']);
  }
  insertRule.free();

  saveDB();
}

// Flush DB to disk immediately (cancels any pending scheduled save)
function saveDB() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (db && dbPath) {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

// Debounced save: flushes at most once every 30 seconds (for high-frequency inserts)
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDB();
  }, 30000);
}

// Reusable query helpers
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

function insertActivity(processName, windowTitle, durationSec) {
  const timestamp = new Date().toISOString();
  db.run(
    'INSERT INTO activity_log (timestamp, process_name, window_title, duration_sec) VALUES (?, ?, ?, ?)',
    [timestamp, processName, windowTitle, durationSec]
  );
  scheduleSave();
}

function getDaySummary(date) {
  const rows = queryAll(`
    SELECT process_name AS name, SUM(duration_sec) AS totalSec
    FROM activity_log
    WHERE date(timestamp, 'localtime') = ?
    GROUP BY process_name
    ORDER BY totalSec DESC
  `, [date]);

  const totalSec = rows.reduce((sum, r) => sum + r.totalSec, 0);
  const apps = rows.map(r => ({
    ...r,
    percentage: totalSec > 0 ? Math.round((r.totalSec / totalSec) * 100) : 0
  }));

  return { apps, totalSec };
}

function getDayActivities(date) {
  return queryAll(`
    SELECT process_name, window_title, SUM(duration_sec) AS totalSec
    FROM activity_log
    WHERE date(timestamp, 'localtime') = ?
    GROUP BY process_name, window_title
    ORDER BY totalSec DESC
  `, [date]);
}

function getJournal(date) {
  return queryOne('SELECT ai_summary, user_notes FROM daily_summary WHERE date = ?', [date])
    || { ai_summary: null, user_notes: '' };
}

const ALLOWED_SUMMARY_COLUMNS = ['user_notes'];

function upsertDailySummaryColumn(date, column, value) {
  if (!ALLOWED_SUMMARY_COLUMNS.includes(column)) {
    throw new Error(`Invalid column: ${column}`);
  }
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO daily_summary (date, ${column}, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET ${column} = ?, updated_at = ?`,
    [date, value, now, now, value, now]
  );
  saveDB();
}

function saveJournalNote(date, note) {
  upsertDailySummaryColumn(date, 'user_notes', note);
}

function getSettings() {
  const rows = queryAll('SELECT key, value FROM settings');
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

function saveSettings(settingsObj) {
  for (const [key, value] of Object.entries(settingsObj)) {
    db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
      [key, String(value), String(value)]
    );
  }
  saveDB();
}

function getAppDetails(date, processName) {
  // Manual entries: return individual rows with id (editable)
  // Auto entries: group by window_title
  const manualRows = queryAll(`
    SELECT id, window_title, duration_sec AS totalSec, 1 AS is_manual
    FROM activity_log
    WHERE date(timestamp, 'localtime') = ? AND process_name = ? AND is_manual = 1
    ORDER BY totalSec DESC
  `, [date, processName]);

  const autoRows = queryAll(`
    SELECT window_title, SUM(duration_sec) AS totalSec, 0 AS is_manual
    FROM activity_log
    WHERE date(timestamp, 'localtime') = ? AND process_name = ? AND (is_manual = 0 OR is_manual IS NULL)
    GROUP BY window_title
    ORDER BY totalSec DESC
  `, [date, processName]);

  const allRows = [...manualRows, ...autoRows].sort((a, b) => b.totalSec - a.totalSec);
  const totalSec = allRows.reduce((sum, r) => sum + r.totalSec, 0);
  const details = allRows.map(r => ({
    id: r.id || null,
    title: r.window_title,
    label: parseTitle(processName, r.window_title),
    totalSec: r.totalSec,
    isManual: !!r.is_manual,
    percentage: totalSec > 0 ? Math.round((r.totalSec / totalSec) * 100) : 0
  }));

  return { details, totalSec };
}

function insertManualActivity(date, processName, windowTitle, durationMin) {
  const timestamp = `${date}T12:00:00.000Z`;
  db.run(
    'INSERT INTO activity_log (timestamp, process_name, window_title, duration_sec, is_manual) VALUES (?, ?, ?, ?, 1)',
    [timestamp, processName, windowTitle, durationMin * 60]
  );
  saveDB();
}

function updateManualActivity(id, durationMin) {
  db.run(
    'UPDATE activity_log SET duration_sec = ? WHERE id = ? AND is_manual = 1',
    [durationMin * 60, id]
  );
  saveDB();
}

function deleteActivity(processName, date) {
  db.run(
    'DELETE FROM activity_log WHERE process_name = ? AND date(timestamp, \'localtime\') = ?',
    [processName, date]
  );
  saveDB();
}

// --- Categories ---

function classifyActivity(processName, windowTitle) {
  if (!processName) return '기타';

  // 1. Try title_pattern match first (more specific)
  if (windowTitle) {
    const titleMatch = queryOne(
      `SELECT category FROM categories
       WHERE process_name = ? AND title_pattern IS NOT NULL
       AND ? LIKE '%' || title_pattern || '%'
       ORDER BY length(title_pattern) DESC LIMIT 1`,
      [processName, windowTitle]
    );
    if (titleMatch) return titleMatch.category;
  }

  // 2. Try process_name-only match
  const procMatch = queryOne(
    'SELECT category FROM categories WHERE process_name = ? AND title_pattern IS NULL LIMIT 1',
    [processName]
  );
  if (procMatch) return procMatch.category;

  // 3. Fallback to title-parser heuristic
  return categorizeByTitle(processName, windowTitle);
}

function getCategoryMap() {
  return queryAll('SELECT * FROM categories ORDER BY process_name, title_pattern');
}

function updateCategory(id, category) {
  db.run('UPDATE categories SET category = ?, source = ? WHERE id = ?', [category, 'manual', id]);

  // Invalidate daily_stats for affected dates
  const rule = queryOne('SELECT process_name FROM categories WHERE id = ?', [id]);
  if (rule) {
    db.run(
      `DELETE FROM daily_stats WHERE date IN (
        SELECT DISTINCT date(timestamp, 'localtime') FROM activity_log WHERE process_name = ?
      )`,
      [rule.process_name]
    );
  }
  saveDB();
}

function addCategoryRule(processName, titlePattern, category) {
  db.run(
    'INSERT OR REPLACE INTO categories (process_name, title_pattern, category, source) VALUES (?, ?, ?, ?)',
    [processName, titlePattern || null, category, 'manual']
  );
  saveDB();
}

// --- Focus Score & Daily Stats ---

const MIN_ACTIVITY_FOR_SCORE_SEC = 2 * 3600; // 2 hours minimum for meaningful score

function calculateFocusScore(date) {
  // Get all activities for the date, classified by category
  const activities = queryAll(`
    SELECT timestamp, process_name, window_title, duration_sec
    FROM activity_log
    WHERE date(timestamp, 'localtime') = ?
    ORDER BY timestamp
  `, [date]);

  if (activities.length === 0) return { focusScore: null, totalSec: 0, deepWorkSec: 0, breakdown: {} };

  // Calculate category breakdown
  const breakdown = {};
  let totalSec = 0;
  for (const act of activities) {
    const cat = classifyActivity(act.process_name, act.window_title);
    breakdown[cat] = (breakdown[cat] || 0) + act.duration_sec;
    totalSec += act.duration_sec;
  }

  // Not enough data for a meaningful score
  if (totalSec < MIN_ACTIVITY_FOR_SCORE_SEC) {
    return { focusScore: null, totalSec, deepWorkSec: 0, breakdown };
  }

  // Calculate deep work blocks
  // Deep work = '개발' or '문서' category, in blocks of 15min+ (with 2min gap tolerance)
  const DEEP_CATEGORIES = new Set(['개발', '문서']);
  const GAP_TOLERANCE_SEC = 120; // 2 minutes
  const MIN_BLOCK_SEC = 900; // 15 minutes

  let blocks = [];
  let currentBlockSec = 0;
  let gapSec = 0;
  let inDeepWork = false;

  for (const act of activities) {
    const cat = classifyActivity(act.process_name, act.window_title);
    const isDeep = DEEP_CATEGORIES.has(cat);

    if (isDeep) {
      if (inDeepWork) {
        // Continue block (absorb any gap that was within tolerance)
        currentBlockSec += gapSec + act.duration_sec;
        gapSec = 0;
      } else {
        // Start new block
        inDeepWork = true;
        currentBlockSec = act.duration_sec;
        gapSec = 0;
      }
    } else {
      if (inDeepWork) {
        gapSec += act.duration_sec;
        if (gapSec > GAP_TOLERANCE_SEC) {
          // Block ended — save if long enough
          if (currentBlockSec >= MIN_BLOCK_SEC) {
            blocks.push(currentBlockSec);
          }
          inDeepWork = false;
          currentBlockSec = 0;
          gapSec = 0;
        }
      }
    }
  }
  // Flush last block
  if (inDeepWork && currentBlockSec >= MIN_BLOCK_SEC) {
    blocks.push(currentBlockSec);
  }

  const deepWorkSec = blocks.reduce((sum, b) => sum + b, 0);
  const focusScore = totalSec > 0 ? Math.round((deepWorkSec / totalSec) * 100) : 0;

  return { focusScore, totalSec, deepWorkSec, breakdown };
}

function getDailyStats(date) {
  const today = toLocalDateStr(new Date());

  // For past dates, try cache first
  if (date !== today) {
    const cached = queryOne('SELECT * FROM daily_stats WHERE date = ?', [date]);
    if (cached) {
      return {
        date: cached.date,
        focusScore: cached.focus_score,
        totalSec: cached.total_sec,
        deepWorkSec: cached.deep_work_sec,
        breakdown: cached.category_breakdown ? JSON.parse(cached.category_breakdown) : {}
      };
    }
  }

  // Calculate live
  const stats = calculateFocusScore(date);

  // Cache for past dates
  if (date !== today && stats.totalSec > 0) {
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO daily_stats (date, focus_score, total_sec, deep_work_sec, category_breakdown, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [date, stats.focusScore, stats.totalSec, stats.deepWorkSec, JSON.stringify(stats.breakdown), now]
    );
    scheduleSave();
  }

  return { date, ...stats };
}

function getWeeklyStats(endDate) {
  const days = [];
  const d = new Date(endDate + 'T00:00:00');
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    const dateStr = toLocalDateStr(day);
    days.push(getDailyStats(dateStr));
  }

  const withScores = days.filter(d => d.focusScore !== null);
  const avgScore = withScores.length > 0
    ? Math.round(withScores.reduce((s, d) => s + d.focusScore, 0) / withScores.length)
    : null;
  const totalSec = days.reduce((s, d) => s + d.totalSec, 0);

  return { days, avgScore, totalSec };
}

function getMonthlyStats(yearMonth) {
  // yearMonth = '2026-03'
  const rows = queryAll(`
    SELECT date, focus_score, total_sec, deep_work_sec, category_breakdown
    FROM daily_stats
    WHERE date LIKE ? || '%'
    ORDER BY date
  `, [yearMonth]);

  return rows.map(r => ({
    date: r.date,
    focusScore: r.focus_score,
    totalSec: r.total_sec,
    deepWorkSec: r.deep_work_sec,
    breakdown: r.category_breakdown ? JSON.parse(r.category_breakdown) : {}
  }));
}

module.exports = {
  initDB, saveDB,
  insertActivity, insertManualActivity, updateManualActivity, deleteActivity,
  getDaySummary, getDayActivities, getAppDetails,
  getJournal, saveJournalNote,
  getSettings, saveSettings,
  // v2
  classifyActivity, getCategoryMap, updateCategory, addCategoryRule,
  calculateFocusScore, getDailyStats, getWeeklyStats, getMonthlyStats
};
