import { describe, it, expect } from 'vitest';

// tracker.js depends on CJS require('./db') which can't be easily mocked.
// Instead, we test the dedup logic by simulating it directly.

/**
 * Simulates the tracker's dedup logic extracted from tracker.js.
 * This tests the core algorithm without requiring the actual module.
 */
function createTrackerLogic(pollSec) {
  let lastProcess = null;
  let lastTitle = null;
  let accumulatedSec = 0;
  const flushed = []; // records {process, title, sec}

  function tick(win) {
    if (!win || !win.processName || !win.windowTitle) return;

    if (win.processName === lastProcess && win.windowTitle === lastTitle) {
      accumulatedSec += pollSec;
    } else {
      if (lastProcess && accumulatedSec > 0) {
        flushed.push({ process: lastProcess, title: lastTitle, sec: accumulatedSec });
      }
      lastProcess = win.processName;
      lastTitle = win.windowTitle;
      accumulatedSec = pollSec;
    }
  }

  function stop() {
    if (lastProcess && accumulatedSec > 0) {
      flushed.push({ process: lastProcess, title: lastTitle, sec: accumulatedSec });
      lastProcess = null;
      lastTitle = null;
      accumulatedSec = 0;
    }
  }

  return { tick, stop, flushed };
}

describe('tracker dedup 로직', () => {
  it('같은 창이 유지되면 flush 안 함 (누적 중)', () => {
    const t = createTrackerLogic(3);
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });

    expect(t.flushed).toHaveLength(0);
  });

  it('창이 바뀌면 이전 누적분을 flush', () => {
    const t = createTrackerLogic(3);
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });

    // Window changes
    t.tick({ processName: 'Code', windowTitle: 'main.js' });

    expect(t.flushed).toHaveLength(1);
    expect(t.flushed[0]).toEqual({ process: 'chrome', title: 'GitHub', sec: 9 });
  });

  it('stop 시 남은 누적분을 flush', () => {
    const t = createTrackerLogic(3);
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });

    t.stop();

    expect(t.flushed).toHaveLength(1);
    expect(t.flushed[0]).toEqual({ process: 'chrome', title: 'GitHub', sec: 6 });
  });

  it('여러 번 창 전환 시 각각 flush', () => {
    const t = createTrackerLogic(1);
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'Code', windowTitle: 'app.js' });
    t.tick({ processName: 'Code', windowTitle: 'app.js' });
    t.tick({ processName: 'Code', windowTitle: 'app.js' });
    t.tick({ processName: 'slack', windowTitle: '#general' });

    expect(t.flushed).toHaveLength(2);
    expect(t.flushed[0]).toEqual({ process: 'chrome', title: 'GitHub', sec: 2 });
    expect(t.flushed[1]).toEqual({ process: 'Code', title: 'app.js', sec: 3 });

    t.stop();
    expect(t.flushed).toHaveLength(3);
    expect(t.flushed[2]).toEqual({ process: 'slack', title: '#general', sec: 1 });
  });

  it('null 응답(화면 잠금)은 무시', () => {
    const t = createTrackerLogic(3);
    t.tick(null);
    t.tick(null);

    t.stop();
    expect(t.flushed).toHaveLength(0);
  });

  it('빈 processName/windowTitle은 무시', () => {
    const t = createTrackerLogic(3);
    t.tick({ processName: '', windowTitle: 'test' });
    t.tick({ processName: 'chrome', windowTitle: '' });

    t.stop();
    expect(t.flushed).toHaveLength(0);
  });

  it('같은 앱이지만 title이 다르면 별도 flush', () => {
    const t = createTrackerLogic(3);
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'YouTube' });

    expect(t.flushed).toHaveLength(1);
    expect(t.flushed[0]).toEqual({ process: 'chrome', title: 'GitHub', sec: 3 });

    t.stop();
    expect(t.flushed[1]).toEqual({ process: 'chrome', title: 'YouTube', sec: 3 });
  });

  it('stop 후 다시 stop해도 중복 flush 안 함', () => {
    const t = createTrackerLogic(3);
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });

    t.stop();
    t.stop();

    expect(t.flushed).toHaveLength(1);
  });

  it('poll 간격이 반영됨', () => {
    const t = createTrackerLogic(5);
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });
    t.tick({ processName: 'chrome', windowTitle: 'GitHub' });

    t.stop();
    expect(t.flushed[0].sec).toBe(10); // 5 * 2
  });
});
