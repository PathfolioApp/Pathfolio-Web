const path = require('path');
const { install, Browser, detectBrowserPlatform, resolveBuildId, getInstalledBrowsers } = require('@puppeteer/browsers');

async function run() {
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.resolve(__dirname, '../.cache/puppeteer');
  const platform = detectBrowserPlatform();

  if (!platform) {
    console.warn('[install-browser] Could not detect platform for Chromium download; skipping.');
    return;
  }

  try {
    const existing = await getInstalledBrowsers({ cacheDir });
    const hasChromium = existing.some(b => b.browser === Browser.CHROMIUM || b.browser === 'chromium');
    if (hasChromium) {
      console.log('[install-browser] Chromium is already installed in:', cacheDir);
      return;
    }
  } catch {
    // Ignore cache check errors and proceed to install
  }

  console.log(`[install-browser] Resolving latest Chromium for ${platform}...`);
  const buildId = await resolveBuildId(Browser.CHROMIUM, platform, 'latest');
  console.log(`[install-browser] Downloading Chromium (${buildId}) to ${cacheDir}...`);

  const installed = await install({
    browser: Browser.CHROMIUM,
    buildId,
    cacheDir,
  });

  console.log(`[install-browser] Chromium successfully installed at: ${installed.executablePath}`);
}

run().catch(err => {
  console.warn(`[install-browser] Warning: Chromium download encountered an issue (${err.message}).`);
  console.warn('[install-browser] Continuing without blocking installation. You can provide PUPPETEER_EXECUTABLE_PATH at runtime.');
});
