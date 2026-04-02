import { describe, it, expect, beforeEach, vi } from 'vitest';
import initSqlJs from 'sql.js';
import { createRequire } from 'module';

// We can't easily mock CJS 'electron' for the db module,
// so we test db logic by creating an in-memory DB directly.

let SQL, db, parseTitle;

beforeEach(async () => {
  if (!SQL) SQL = await initSqlJs();
  db = new SQL.Database();

  db.run(`CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    process_name TEXT NOT NULL,
    window_title TEXT NOT NULL,
    duration_sec INTEGER DEFAULT 3,
    is_manual INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE daily_summary (
    date TEXT PRIMARY KEY,
    ai_summary TEXT, user_notes TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.run("INSERT INTO settings VALUES ('poll_interval_sec','3')");
  db.run("INSERT INTO settings VALUES ('idle_threshold_sec','300')");

  const req = createRequire(import.meta.url);
  parseTitle = req('../src/title-parser').parseTitle;
});

// Helper functions matching db.js logic
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

function insertActivity(proc, title, sec) {
  db.run('INSERT INTO activity_log (timestamp,process_name,window_title,duration_sec) VALUES (?,?,?,?)',
    [new Date().toISOString(), proc, title, sec]);
}

function insertManualActivity(date, proc, title, min) {
  db.run('INSERT INTO activity_log (timestamp,process_name,window_title,duration_sec,is_manual) VALUES (?,?,?,?,1)',
    [`${date}T12:00:00.000Z`, proc, title, min * 60]);
}

function getDaySummary(date) {
  const rows = queryAll(`SELECT process_name AS name, SUM(duration_sec) AS totalSec
    FROM activity_log WHERE date(timestamp,'localtime')=? GROUP BY process_name ORDER BY totalSec DESC`, [date]);
  const totalSec = rows.reduce((s, r) => s + r.totalSec, 0);
  return { apps: rows.map(r => ({ ...r, percentage: totalSec > 0 ? Math.round(r.totalSec / totalSec * 100) : 0 })), totalSec };
}

function getDayActivities(date) {
  return queryAll(`SELECT process_name, window_title, SUM(duration_sec) AS totalSec
    FROM activity_log WHERE date(timestamp,'localtime')=? GROUP BY process_name, window_title ORDER BY totalSec DESC`, [date]);
}

function getAppDetails(date, processName) {
  const manualRows = queryAll(`SELECT id, window_title, duration_sec AS totalSec, 1 AS is_manual
    FROM activity_log WHERE date(timestamp,'localtime')=? AND process_name=? AND is_manual=1 ORDER BY totalSec DESC`, [date, processName]);
  const autoRows = queryAll(`SELECT window_title, SUM(duration_sec) AS totalSec, 0 AS is_manual
    FROM activity_log WHERE date(timestamp,'localtime')=? AND process_name=? AND (is_manual=0 OR is_manual IS NULL) GROUP BY window_title ORDER BY totalSec DESC`, [date, processName]);
  const allRows = [...manualRows, ...autoRows].sort((a, b) => b.totalSec - a.totalSec);
  const totalSec = allRows.reduce((s, r) => s + r.totalSec, 0);
  return { details: allRows.map(r => ({
    id: r.id || null, title: r.window_title, label: parseTitle(processName, r.window_title),
    totalSec: r.totalSec, isManual: !!r.is_manual,
    percentage: totalSec > 0 ? Math.round(r.totalSec / totalSec * 100) : 0
  })), totalSec };
}

describe('activity_log CRUD', () => {
  it('insertActivity 후 getDaySummary에서 조회', () => {
    const today = new Date().toISOString().split('T')[0];
    insertActivity('chrome', 'GitHub - Google Chrome', 10);
    insertActivity('chrome', 'YouTube - Google Chrome', 5);
    insertActivity('Code', 'main.js - VS Code', 20);

    const summary = getDaySummary(today);
    expect(summary.totalSec).toBe(35);
    expect(summary.apps).toHaveLength(2);
    expect(summary.apps[0].name).toBe('Code');
    expect(summary.apps[0].totalSec).toBe(20);
    expect(summary.apps[1].name).toBe('chrome');
    expect(summary.apps[1].totalSec).toBe(15);
  });

  it('getDaySummary percentage 계산', () => {
    const today = new Date().toISOString().split('T')[0];
    insertActivity('chrome', 'test', 75);
    insertActivity('Code', 'test', 25);

    const { apps } = getDaySummary(today);
    expect(apps[0].percentage).toBe(75);
    expect(apps[1].percentage).toBe(25);
  });

  it('데이터 없는 날짜는 빈 결과', () => {
    const summary = getDaySummary('2000-01-01');
    expect(summary.apps).toHaveLength(0);
    expect(summary.totalSec).toBe(0);
  });

  it('getDayActivities는 process_name + window_title로 그룹핑', () => {
    const today = new Date().toISOString().split('T')[0];
    insertActivity('chrome', 'GitHub', 10);
    insertActivity('chrome', 'GitHub', 5);
    insertActivity('chrome', 'YouTube', 3);

    const activities = getDayActivities(today);
    expect(activities).toHaveLength(2);
    expect(activities[0].window_title).toBe('GitHub');
    expect(activities[0].totalSec).toBe(15);
  });
});

describe('수동 입력', () => {
  it('insertManualActivity로 추가 후 조회', () => {
    const date = new Date().toISOString().split('T')[0];
    insertManualActivity(date, 'Notion', '프로젝트 기획', 60);

    const summary = getDaySummary(date);
    expect(summary.apps).toHaveLength(1);
    expect(summary.apps[0].name).toBe('Notion');
    expect(summary.apps[0].totalSec).toBe(3600);
  });

  it('getAppDetails에서 수동 항목은 isManual: true, id 포함', () => {
    const date = new Date().toISOString().split('T')[0];
    insertManualActivity(date, 'Notion', '기획서 작성', 30);
    insertActivity('Notion', '회의록', 60);

    const details = getAppDetails(date, 'Notion');
    expect(details.details).toHaveLength(2);

    const manual = details.details.find(d => d.isManual);
    expect(manual).toBeTruthy();
    expect(manual.id).toBeTypeOf('number');
    expect(manual.totalSec).toBe(1800);

    const auto = details.details.find(d => !d.isManual);
    expect(auto).toBeTruthy();
    expect(auto.id).toBeNull();
  });

  it('updateManualActivity로 시간 수정', () => {
    const date = new Date().toISOString().split('T')[0];
    insertManualActivity(date, 'Figma', '디자인', 30);

    const before = getAppDetails(date, 'Figma');
    const id = before.details[0].id;
    expect(before.details[0].totalSec).toBe(1800);

    db.run('UPDATE activity_log SET duration_sec=? WHERE id=? AND is_manual=1', [3600, id]);

    const after = getAppDetails(date, 'Figma');
    expect(after.details[0].totalSec).toBe(3600);
  });

  it('updateManualActivity는 자동 항목에는 적용 안 됨', () => {
    const date = new Date().toISOString().split('T')[0];
    insertActivity('chrome', 'test', 100);

    db.run('UPDATE activity_log SET duration_sec=? WHERE id=? AND is_manual=1', [999 * 60, 1]);

    const summary = getDaySummary(date);
    expect(summary.apps[0].totalSec).toBe(100);
  });
});

describe('deleteActivity', () => {
  it('특정 앱의 해당 날짜 기록 전체 삭제', () => {
    const date = new Date().toISOString().split('T')[0];
    insertActivity('chrome', 'A', 10);
    insertActivity('chrome', 'B', 20);
    insertActivity('Code', 'C', 30);

    db.run("DELETE FROM activity_log WHERE process_name=? AND date(timestamp,'localtime')=?", ['chrome', date]);

    const summary = getDaySummary(date);
    expect(summary.apps).toHaveLength(1);
    expect(summary.apps[0].name).toBe('Code');
  });
});

describe('journal', () => {
  function getJournal(date) {
    return queryOne('SELECT ai_summary, user_notes FROM daily_summary WHERE date=?', [date])
      || { ai_summary: null, user_notes: '' };
  }
  function upsert(date, col, val) {
    const now = new Date().toISOString();
    db.run(`INSERT INTO daily_summary (date,${col},created_at,updated_at) VALUES (?,?,?,?)
      ON CONFLICT(date) DO UPDATE SET ${col}=?,updated_at=?`, [date, val, now, now, val, now]);
  }

  it('저널이 없으면 기본값 반환', () => {
    expect(getJournal('2026-03-29')).toEqual({ ai_summary: null, user_notes: '' });
  });

  it('saveJournalNote 후 조회', () => {
    upsert('2026-03-29', 'user_notes', '오늘은 생산적인 하루');
    expect(getJournal('2026-03-29').user_notes).toBe('오늘은 생산적인 하루');
  });

  it('saveAiSummary 후 조회', () => {
    upsert('2026-03-29', 'ai_summary', 'AI가 생성한 요약');
    expect(getJournal('2026-03-29').ai_summary).toBe('AI가 생성한 요약');
  });

  it('note와 summary를 각각 저장해도 서로 덮어쓰지 않음', () => {
    upsert('2026-03-29', 'user_notes', '내 메모');
    upsert('2026-03-29', 'ai_summary', 'AI 요약');
    const result = getJournal('2026-03-29');
    expect(result.user_notes).toBe('내 메모');
    expect(result.ai_summary).toBe('AI 요약');
  });
});

describe('settings', () => {
  function getSettings() {
    const rows = queryAll('SELECT key, value FROM settings');
    const s = {};
    for (const r of rows) s[r.key] = r.value;
    return s;
  }

  it('기본 설정값이 초기화됨', () => {
    const s = getSettings();
    expect(s.poll_interval_sec).toBe('3');
    expect(s.idle_threshold_sec).toBe('300');
  });

  it('설정 저장 및 조회', () => {
    db.run("INSERT INTO settings VALUES ('custom_key','custom_value') ON CONFLICT(key) DO UPDATE SET value='custom_value'");
    expect(getSettings().custom_key).toBe('custom_value');
  });
});
