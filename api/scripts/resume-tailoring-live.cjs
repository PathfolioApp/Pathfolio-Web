// Explicit opt-in integration check. Sends ONLY the shared synthetic profile.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');
const { jd, student, loadService } = require('./resume-tailoring.fixture.cjs');
const { closePdfBrowser } = require('../src/modules/resumes/resumePdf.service');

async function run() {
  if (!process.argv.includes('--live')) throw Error('Live provider checks require --live; they consume provider quota.');
  const vars = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../.env')));
  const reports = [];
  for (const mode of ['gemini-first', 'groq-only']) {
    if (!(mode === 'gemini-first' ? vars.GEMINI_API_KEY : vars.GROQ_API_KEY)) { reports.push({ mode, outcome: 'skipped_unconfigured' }); continue; }
    const attempts = []; const started = Date.now();
    const engine = loadService({ profile: structuredClone(student), config: {
      geminiApiKey: mode === 'gemini-first' ? vars.GEMINI_API_KEY : null,
      groqApiKey: vars.GROQ_API_KEY || null, groqModel: vars.GROQ_MODEL || 'openai/gpt-oss-120b',
    }, fetch: async (url, options) => {
      const target = new URL(url);
      assert.ok(['generativelanguage.googleapis.com', 'api.groq.com'].includes(target.hostname));
      const remaining = 30000 - (Date.now() - started);
      if (remaining <= 0) throw Object.assign(Error('Live check budget exhausted'), { name: 'AbortError' });
      const attempt = { provider: target.hostname === 'api.groq.com' ? 'groq' : 'gemini', model: target.hostname === 'api.groq.com' ? JSON.parse(options.body).model : target.pathname.split('/').pop().split(':')[0] };
      attempts.push(attempt);
      const attemptStart = Date.now();
      const signal = AbortSignal.any([options.signal, AbortSignal.timeout(Math.min(12000, remaining))]);
      try {
        const response = await fetch(url, { ...options, signal });
        attempt.status = response.status;
        // Consume the body while the bounded signal is still active.
        const text = await response.text();
        return { ok: response.ok, status: response.status, text: async () => text, json: async () => JSON.parse(text) };
      } catch (error) {
        attempt.failure = signal.aborted ? 'timeout' : 'network_error';
        throw error;
      } finally { attempt.durationMs = Date.now() - attemptStart; }
    } });
    try {
      const { resumeData, tailoredMeta } = await engine.tailorForJd('synthetic-live-check', { jobTitle: 'Java Backend Developer', company: 'Example Test Company', jobDescription: jd });
      assert.equal(resumeData.personal.fullName, student.personal.fullName);
      const snack = resumeData.projects.find(p => p.title === 'SnackIt');
      assert.ok(snack); assert.match(snack.technologies, /Backend: Node\.js, Express\.js/);
      assert.ok(!snack.technologies.includes('Spring Boot'));
      assert.equal(tailoredMeta.pageCount, 1);
      reports.push({ mode, outcome: 'completed', engine: tailoredMeta.modelUsed, pageCount: 1, sourceStackPreserved: true, durationMs: Date.now() - started, attempts });
    } catch (error) {
      // Do not print error bodies or URLs: provider credentials can appear there.
      reports.push({ mode, outcome: 'failed', kind: error.code || error.name, statusCode: error.statusCode, durationMs: Date.now() - started, attempts });
    }
    console.log(JSON.stringify(reports[reports.length - 1]));
  }
  const reportPath = path.resolve(__dirname, '../../tmp/resume-tailoring-live-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2));
  if (reports.some(report => report.outcome === 'failed')) process.exitCode = 1;
}
run().catch(() => { console.error('Live check could not initialize; no credentials printed.'); process.exitCode = 1; }).finally(closePdfBrowser);
