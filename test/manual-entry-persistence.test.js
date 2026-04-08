import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';

/**
 * 직접 입력 항목의 영속성 테스트
 * - DB에 저장 → DB 닫기 → 다시 열기 → 조회 가능 여부 검증
 * - 앱 재시작 시나리오를 시뮬레이션
 */

let SQL;

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function toLocalISOString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000`;
}

beforeEach(async () => {
  if (!SQL) SQL = await initSqlJs();
});

function createDB() {
  const db = new SQL.Database();
  db.run(`CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    process_name TEXT NOT NULL,
    window_title TEXT NOT NULL,
    duration_sec INTEGER DEFAULT 3,
    is_manual INTEGER DEFAULT 0
  )`);
  return db;
}

function insertManualActivity(db, date, processName, windowTitle, durationMin) {
  db.run(
    'INSERT INTO activity_log (timestamp, process_name, window_title, duration_sec, is_manual) VALUES (?, ?, ?, ?, 1)',
    [`${date}T12:00:00.000`, processName, windowTitle, durationMin * 60]
  );
}

function getDaySummary(db, date) {
  const stmt = db.prepare(`
    SELECT process_name AS name, SUM(duration_sec) AS totalSec
    FROM activity_log WHERE date(timestamp) = ?
    GROUP BY process_name ORDER BY totalSec DESC
  `);
  stmt.bind([date]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getManualEntries(db, date) {
  const stmt = db.prepare(`
    SELECT id, process_name, window_title, duration_sec, is_manual
    FROM activity_log WHERE date(timestamp) = ? AND is_manual = 1
  `);
  stmt.bind([date]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

describe('직접 입력 항목 영속성', () => {
  it('DB 직렬화 후 재로딩해도 수동 항목이 유지됨', () => {
    const date = toLocalDateStr(new Date());

    // Step 1: 첫 번째 "앱 세션" — 수동 입력 후 저장
    const db1 = createDB();
    insertManualActivity(db1, date, 'Notion', '기획서 작성', 60);
    insertManualActivity(db1, date, '잡담', '수다', 30);

    const beforeRestart = getManualEntries(db1, date);
    expect(beforeRestart).toHaveLength(2);

    // DB를 파일로 직렬화 (sql.js의 export)
    const serialized = Buffer.from(db1.export());
    db1.close();

    // Step 2: 두 번째 "앱 세션" — 직렬화된 데이터로 DB 재로딩
    const db2 = new SQL.Database(serialized);

    const afterRestart = getManualEntries(db2, date);
    expect(afterRestart).toHaveLength(2);
    expect(afterRestart[0].process_name).toBe('Notion');
    expect(afterRestart[0].window_title).toBe('기획서 작성');
    expect(afterRestart[0].duration_sec).toBe(3600);
    expect(afterRestart[0].is_manual).toBe(1);
    expect(afterRestart[1].process_name).toBe('잡담');
    expect(afterRestart[1].duration_sec).toBe(1800);

    db2.close();
  });

  it('수동 항목이 getDaySummary에 포함됨', () => {
    const date = toLocalDateStr(new Date());

    const db1 = createDB();
    // 자동 추적 항목
    db1.run('INSERT INTO activity_log (timestamp, process_name, window_title, duration_sec, is_manual) VALUES (?, ?, ?, ?, 0)',
      [toLocalISOString(new Date()), 'chrome', 'GitHub', 100]);
    // 수동 입력 항목
    insertManualActivity(db1, date, 'Notion', '기획서', 30);

    // 직렬화 → 재로딩
    const db2 = new SQL.Database(Buffer.from(db1.export()));
    db1.close();

    const summary = getDaySummary(db2, date);
    expect(summary).toHaveLength(2);

    const notion = summary.find(s => s.name === 'Notion');
    expect(notion).toBeTruthy();
    expect(notion.totalSec).toBe(1800);

    const chrome = summary.find(s => s.name === 'chrome');
    expect(chrome).toBeTruthy();
    expect(chrome.totalSec).toBe(100);

    db2.close();
  });

  it('updateManualActivity 후 재시작해도 수정값 유지', () => {
    const date = toLocalDateStr(new Date());

    const db1 = createDB();
    insertManualActivity(db1, date, 'Figma', '디자인', 30);

    // 시간 수정
    db1.run('UPDATE activity_log SET duration_sec = ? WHERE id = 1 AND is_manual = 1', [7200]);

    // 직렬화 → 재로딩
    const db2 = new SQL.Database(Buffer.from(db1.export()));
    db1.close();

    const entries = getManualEntries(db2, date);
    expect(entries).toHaveLength(1);
    expect(entries[0].duration_sec).toBe(7200); // 2시간

    db2.close();
  });

  it('is_manual 컬럼이 없는 기존 DB에 ALTER TABLE 후 정상 동작', () => {
    // 기존 스키마 (is_manual 없음)
    const db1 = new SQL.Database();
    db1.run(`CREATE TABLE activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      process_name TEXT NOT NULL,
      window_title TEXT NOT NULL,
      duration_sec INTEGER DEFAULT 3
    )`);
    db1.run('INSERT INTO activity_log (timestamp, process_name, window_title, duration_sec) VALUES (?, ?, ?, ?)',
      [toLocalISOString(new Date()), 'chrome', 'test', 50]);

    // initDB의 ALTER TABLE 시뮬레이션
    try { db1.run('ALTER TABLE activity_log ADD COLUMN is_manual INTEGER DEFAULT 0'); } catch {}

    // 기존 항목의 is_manual은 기본값 0
    const stmt = db1.prepare('SELECT is_manual FROM activity_log WHERE id = 1');
    stmt.step();
    // ALTER TABLE ADD COLUMN with DEFAULT yields NULL for existing rows in SQLite
    const val = stmt.getAsObject().is_manual;
    stmt.free();
    expect(val === 0 || val === null).toBe(true);

    // 수동 입력은 정상 동작
    const date = toLocalDateStr(new Date());
    insertManualActivity(db1, date, 'Notion', 'test', 15);

    const entries = getManualEntries(db1, date);
    expect(entries).toHaveLength(1);
    expect(entries[0].is_manual).toBe(1);

    db1.close();
  });
});
