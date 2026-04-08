import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the module under test
const { checkForUpdates, isNewer } = await import('../src/updater.js');

describe('isNewer', () => {
  it('detects newer major version', () => {
    expect(isNewer('1.0.0', '0.3.1')).toBe(true);
  });

  it('detects newer minor version', () => {
    expect(isNewer('0.4.0', '0.3.1')).toBe(true);
  });

  it('detects newer patch version', () => {
    expect(isNewer('0.3.2', '0.3.1')).toBe(true);
  });

  it('returns false for same version', () => {
    expect(isNewer('0.3.1', '0.3.1')).toBe(false);
  });

  it('returns false for older version', () => {
    expect(isNewer('0.3.0', '0.3.1')).toBe(false);
  });

  it('handles versions with different segment counts', () => {
    expect(isNewer('0.4', '0.3.1')).toBe(true);
    expect(isNewer('0.3.1', '0.4')).toBe(false);
  });
});

describe('checkForUpdates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns hasUpdate true when newer version available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tag_name: 'v0.4.0',
        html_url: 'https://github.com/miheeya/haru-haru/releases/tag/v0.4.0',
        body: 'New features'
      })
    }));

    const result = await checkForUpdates('0.3.1');
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('0.4.0');
    expect(result.downloadUrl).toContain('github.com');
    expect(result.releaseNotes).toBe('New features');
  });

  it('returns hasUpdate false when same version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tag_name: 'v0.3.1', html_url: '', body: '' })
    }));

    const result = await checkForUpdates('0.3.1');
    expect(result.hasUpdate).toBe(false);
  });

  it('handles tag_name without v prefix', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tag_name: '0.4.0', html_url: '', body: '' })
    }));

    const result = await checkForUpdates('0.3.1');
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('0.4.0');
  });

  it('returns hasUpdate false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await checkForUpdates('0.3.1');
    expect(result.hasUpdate).toBe(false);
  });

  it('returns hasUpdate false on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await checkForUpdates('0.3.1');
    expect(result.hasUpdate).toBe(false);
  });

  it('returns hasUpdate false when tag_name is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ html_url: '', body: '' })
    }));

    const result = await checkForUpdates('0.3.1');
    expect(result.hasUpdate).toBe(false);
  });

  it('returns hasUpdate false on invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON'))
    }));

    const result = await checkForUpdates('0.3.1');
    expect(result.hasUpdate).toBe(false);
  });
});
