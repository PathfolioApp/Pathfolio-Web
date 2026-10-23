const log = require('../../shared/logger');
const path = require('path');
const fs = require('fs');

const MAX_HTML_BYTES = 512 * 1024;
const MAX_CONCURRENT_EXPORTS = 2;
const EXPORT_TIMEOUT_MS = 25_000;
let activeExports = 0;
let browserPromise = null;
let idleTimer = null;

const failure = (message, statusCode) => Object.assign(new Error(message), { statusCode });

/**
 * Chromium's renderer sandbox needs either unprivileged user namespaces or a
 * setuid helper. Some container platforms (e.g. Pterodactyl) block both, so the
 * browser aborts with "No usable sandbox". There the container is the isolation
 * boundary; opt out explicitly rather than silently weakening every deployment.
 */
function sandboxDisabled() {
  return /^(1|true|yes)$/i.test(String(process.env.PUPPETEER_NO_SANDBOX || '').trim());
}

if (sandboxDisabled()) {
  log.api.warn(
    '[Resume PDF] Chromium sandbox disabled by PUPPETEER_NO_SANDBOX. ' +
    'Only do this where the container itself is the isolation boundary.'
  );
}

function validateHtml(html) {
  if (typeof html !== 'string' || !/^\s*<!doctype html>/i.test(html)) {
    throw failure('A printable resume document is required.', 400);
  }
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    throw failure('The resume is too large to export. Please shorten its content.', 413);
  }
}

/**
 * Resolve the Chromium executable path.
 *
 * Priority:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (explicit override)
 *   2. getInstalledBrowsers from @puppeteer/browsers
 *   3. Manual directory scan of local browser cache (.cache/puppeteer)
 */
async function resolveChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.resolve(__dirname, '../../../.cache/puppeteer');

  try {
    const { getInstalledBrowsers, Browser } = await import('@puppeteer/browsers');
    const installed = await getInstalledBrowsers({ cacheDir });
    const match = installed.find(b => b.browser === Browser.CHROMIUM || b.browser === 'chromium');
    if (match && match.executablePath && fs.existsSync(match.executablePath)) {
      return match.executablePath;
    }
  } catch {
    // Fall back to filesystem scan
  }

  const chromiumDir = path.join(cacheDir, 'chromium');
  if (fs.existsSync(chromiumDir)) {
    try {
      const buildIds = fs.readdirSync(chromiumDir).sort().reverse();
      for (const buildId of buildIds) {
        const buildDir = path.join(chromiumDir, buildId);
        if (!fs.statSync(buildDir).isDirectory()) continue;
        const platforms = fs.readdirSync(buildDir);
        for (const plat of platforms) {
          const platDir = path.join(buildDir, plat);
          if (!fs.statSync(platDir).isDirectory()) continue;
          const candidates = process.platform === 'win32'
            ? [path.join(platDir, 'chrome-win', 'chrome.exe'), path.join(platDir, 'chrome.exe')]
            : [path.join(platDir, 'chrome-linux', 'chrome'), path.join(platDir, 'chrome')];
          for (const c of candidates) {
            if (fs.existsSync(c)) return c;
          }
        }
      }
    } catch { /* fall through */ }
  }

  throw failure(
    'Chromium executable not found. Run "npm run pdf:install-browser" or set PUPPETEER_EXECUTABLE_PATH.',
    503
  );
}

async function getBrowser() {
  clearTimeout(idleTimer);
  if (!browserPromise) {
    const pending = (async () => {
      const executablePath = await resolveChromiumPath();
      const { default: puppeteer } = await import('puppeteer-core');
      const args = sandboxDisabled()
        ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        : [];
      return puppeteer.launch({
        executablePath,
        headless: true,
        timeout: 10_000,
        protocolTimeout: 15_000,
        args,
      });
    })();
    browserPromise = pending;
    pending.then(browser => browser.on('disconnected', () => {
      if (browserPromise === pending) browserPromise = null;
    })).catch(() => { if (browserPromise === pending) browserPromise = null; });
  }
  try { return await browserPromise; }
  catch (error) {
    const noSandbox = /No usable sandbox/i.test(error.message || '');
    log.api.warn('[Resume PDF] Chromium could not start.', {
      reason: error.message,
      ...(noSandbox
        ? { hint: 'Host blocks the browser sandbox. Set PUPPETEER_NO_SANDBOX=1 only where the container is the isolation boundary.' }
        : {}),
    });
    throw failure('PDF export is unavailable. Check the server\u2019s Chromium installation or use Print / Save as PDF.', 503);
  }
}

async function closePdfBrowser() {
  clearTimeout(idleTimer);
  const pending = browserPromise;
  browserPromise = null;
  if (pending) await pending.then(browser => browser.close()).catch(() => {});
}

async function renderResumePdf(html) {
  validateHtml(html);
  if (activeExports >= MAX_CONCURRENT_EXPORTS) {
    throw failure('PDF export is busy. Please try again in a few seconds.', 503);
  }
  activeExports++;
  clearTimeout(idleTimer);
  let context;
  let expired = false;
  let deadline;
  const started = Date.now();
  const checkDeadline = () => { if (expired) throw failure('PDF export timed out. Please try again.', 504); };
  const render = async () => {
    try {
      const browser = await getBrowser();
      checkDeadline();
      context = await browser.createBrowserContext();
      checkDeadline();
      const page = await context.newPage();
      checkDeadline();
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', request => { request.abort().catch(() => {}); });
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.emulateMediaType('print');
      const policy = '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src &#39;none&#39;; font-src &#39;none&#39;; frame-src &#39;none&#39;; object-src &#39;none&#39;; form-action &#39;none&#39;">';
      const document = html.replace(/<head(?:\s[^>]*)?>/, match => match + policy);
      await page.setContent(document, { waitUntil: 'domcontentloaded', timeout: 8_000 });
      const { DENSITY_LIMITS } = await import('../../../../shared/resume/resumeDocument.mjs');
      await page.evaluate(async limits => {
        await document.fonts.ready;
        const resume = document.querySelector('.resume[data-auto-density="true"]');
        if (!resume) return;
        if (resume.getBoundingClientRect().height > limits.compact) resume.classList.add('is-compact');
        if (resume.getBoundingClientRect().height > limits.condense) resume.classList.add('is-condensed');
      }, DENSITY_LIMITS);
      checkDeadline();
      const pdf = Buffer.from(await page.pdf({
        format: 'A4', printBackground: true, displayHeaderFooter: false,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: 1, preferCSSPageSize: true, tagged: true, timeout: 15_000
      }));
      checkDeadline();
      log.api.info('[Resume PDF] Export completed.', { bytes: pdf.length, durationMs: Date.now() - started });
      return pdf;
    } finally {
      if (context) await context.close().catch(() => {});
    }
  };
  try {
    return await Promise.race([render(), new Promise((_, reject) => {
      deadline = setTimeout(() => {
        expired = true;
        if (context) context.close().catch(() => {});
        reject(failure('PDF export timed out. Please try again.', 504));
      }, EXPORT_TIMEOUT_MS);
    })]);
  } finally {
    clearTimeout(deadline);
    activeExports--;
    if (!activeExports) {
      idleTimer = setTimeout(() => { closePdfBrowser().catch(() => {}); }, 30_000);
      idleTimer.unref?.();
    }
  }
}

module.exports = { renderResumePdf, closePdfBrowser, validateHtml };
