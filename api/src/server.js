const app = require('./app');
const config = require('./config');
const log = require('./shared/logger');
const { reportDbFailure } = require('./shared/dbDiagnostics');

// Domain-owned data stores (initialize schema / connections).
const studentStore = require('./modules/students/studentStore');
const adminContentStore = require('./modules/admin/adminContentStore');
const resumeStore = require('./modules/resumes/resumeStore');
const recruiterShareService = require('./modules/recruiters/recruiterShare.service');
const auditLogService = require('./shared/auditLog.service');
const adminUserService = require('./modules/admin/adminUser.service');

/**
 * Run one startup step and log its outcome with timing, so the console reads
 * as a checklist instead of silence until something breaks.
 * Resolves to { ok: true } or { ok: false, error }.
 */
async function runStep(name, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    log.startup.info(`${name} ready (${Date.now() - startedAt}ms)`);
    return { ok: true };
  } catch (error) {
    log.startup.error(`${name} FAILED: ${log.describeError(error)}`);
    return { ok: false, error };
  }
}

/**
 * Translate persistence-layer failures into human-readable next steps.
 * `connect ETIMEDOUT` alone says nothing; this tells you which store failed,
 * which host it dialed, and the likely causes with fixes.
 */
function persistenceFailureDiagnosis(storeName, error) {
  const networkish = error && /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ER_ACCESS_DENIED|ER_BAD_DB/.test(String(error.code || ''));
  if (networkish) {
    reportDbFailure('db', error, { host: config.db.host, port: config.db.port, database: config.db.name });
    log.startup.error(`Startup halted at "${storeName}": the database is required (NODE_ENV=${config.nodeEnv}, USE_DATABASE=${process.env.USE_DATABASE || 'unset'}).`);
    log.startup.error('To run without MySQL, unset DB_HOST / set USE_DATABASE=false in api/.env (volatile dev storage).');
    return;
  }
  log.startup.error(`Startup halted at "${storeName}": ${log.describeError(error)}`);
  log.startup.error(...log.stack(error));
}

async function start() {
  log.startup.info(`Starting PathfolioApp API (env=${config.nodeEnv}, port=${config.port})`);
  log.startup.info(`Database target: ${config.db.host || 'not configured'}:${config.db.port || 'default'} / ${config.db.name || 'no schema'} (databaseConfigured=${config.databaseConfigured})`);

  const steps = [
    ['Student store', () => studentStore.initialize()],
    ['Admin content store', () => adminContentStore.initialize()],
    ['Resume store', () => resumeStore.initialize(studentStore.pool)],
    ['Recruiter shares', () => recruiterShareService.initialize()],
    ['Audit log', () => auditLogService.initialize()]
  ];

  for (const [name, fn] of steps) {
    const result = await runStep(name, fn);
    if (!result.ok) {
      persistenceFailureDiagnosis(name, result.error);
      process.exit(1);
    }
  }

  const bootstrapAdmin = await adminUserService.ensureBootstrapAdmin(config);
  if (bootstrapAdmin) log.startup.info(`Bootstrap admin ready for ${bootstrapAdmin.email}`);

  const server = app.listen(config.port, () => {
    log.startup.info('──────────────────────────────────────────────');
    log.startup.info('PathfolioApp Backend API');
    log.startup.info(`Health:      http://localhost:${config.port}/api/health`);
    log.startup.info(`Environment: ${config.nodeEnv}`);
    log.startup.info(`Port:        ${config.port}`);
    log.startup.info('──────────────────────────────────────────────');
    log.startup.info('Persistence: all stores ready');
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      log.startup.error(`Port ${config.port} is already in use.`);
      log.startup.error('Fix: stop the other process using this port, or set PORT in api/.env.');
      process.exit(1);
    } else {
      log.startup.error('HTTP server error:', ...log.stack(err));
      process.exit(1);
    }
  });

  process.on('SIGTERM', () => {
    log.startup.info('SIGTERM received: closing HTTP server');
    server.close(() => {
      log.startup.info('HTTP server closed');
      process.exit(0);
    });
  });
}

start().catch(error => {
  // Covers bootstrap-admin creation failures and anything thrown outside the
  // per-step runners.
  log.startup.error('Startup failed:', ...log.stack(error));
  process.exit(1);
});
