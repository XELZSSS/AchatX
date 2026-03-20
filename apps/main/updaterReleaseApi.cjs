const https = require('https');

const RELEASE_API_URL = 'https://api.github.com/repos/XELZSSS/Orlinx/releases/latest';
const RELEASES_API_URL = 'https://api.github.com/repos/XELZSSS/Orlinx/releases?per_page=10';
const UPDATE_REQUEST_TIMEOUT_MS = 15000;

const requestJson = (url) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Orlinx-Updater',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('error', reject);
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(buildApiError(res.statusCode, data));
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(UPDATE_REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`GitHub API request timed out after ${UPDATE_REQUEST_TIMEOUT_MS}ms`));
    });
    req.end();
  });

const buildApiError = (statusCode, data) => {
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed?.message === 'string' && parsed.message) {
      return new Error(`GitHub API error: ${statusCode} ${parsed.message}`);
    }
  } catch {
    // Ignore invalid error payloads.
  }

  return new Error(`GitHub API error: ${statusCode}`);
};

const resolveLatestRelease = async () => {
  try {
    return await requestJson(RELEASE_API_URL);
  } catch (latestError) {
    const releases = await requestJson(RELEASES_API_URL);
    if (!Array.isArray(releases)) {
      throw latestError;
    }

    const fallbackRelease = releases.find((release) => !release?.draft && !release?.prerelease);
    if (!fallbackRelease) {
      throw latestError;
    }

    return fallbackRelease;
  }
};

const resolveWindowsInstallerUrl = (release) => {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const preferredAsset = assets.find((asset) => {
    const name = String(asset?.name ?? '').toLowerCase();
    return name.endsWith('.exe') && (name.includes('setup') || name.includes('installer'));
  });

  if (preferredAsset?.browser_download_url) {
    return String(preferredAsset.browser_download_url);
  }

  const fallbackAsset = assets.find((asset) =>
    String(asset?.name ?? '')
      .toLowerCase()
      .endsWith('.exe')
  );
  return fallbackAsset?.browser_download_url ? String(fallbackAsset.browser_download_url) : '';
};

module.exports = {
  resolveLatestRelease,
  resolveWindowsInstallerUrl,
};

