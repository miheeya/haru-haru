const OWNER = 'miheeya';
const REPO = 'haru-haru';

/**
 * Compare two semver strings (e.g., "0.3.1" vs "0.4.0").
 * Returns true if remote > local.
 */
function isNewer(remoteVersion, localVersion) {
  const r = remoteVersion.split('.').map(Number);
  const l = localVersion.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

/**
 * Check GitHub Releases for a newer version.
 * Returns { hasUpdate, currentVersion, latestVersion, downloadUrl, releaseNotes }
 * On any error, returns { hasUpdate: false } silently.
 */
async function checkForUpdates(currentVersion) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`,
      { headers: { 'User-Agent': 'haru-haru-updater' } }
    );
    if (!res.ok) return { hasUpdate: false };

    const data = await res.json();
    if (!data.tag_name) return { hasUpdate: false };

    const latestVersion = data.tag_name.replace(/^v/, '');

    if (isNewer(latestVersion, currentVersion)) {
      return {
        hasUpdate: true,
        currentVersion,
        latestVersion,
        downloadUrl: data.html_url,
        releaseNotes: data.body || ''
      };
    }

    return { hasUpdate: false, currentVersion, latestVersion };
  } catch {
    return { hasUpdate: false };
  }
}

module.exports = { checkForUpdates, isNewer };
