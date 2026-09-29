const app = require('./app');
const config = require('./config');

const store = require('./models/studentStore');
const adminContentStore = require('./models/adminContentStore');
const resumeStore = require('./models/resumeStore');
const adminUserService = require('./services/adminUser.service');
async function start() { await store.initialize(); await adminContentStore.initialize(); await resumeStore.initialize(store.pool); const bootstrapAdmin = await adminUserService.ensureBootstrapAdmin(config); if (bootstrapAdmin) console.log(`[PathfolioApp] Bootstrap admin ready for ${bootstrapAdmin.email}.`); const server = app.listen(config.port, () => {
  console.log(`\n======================================================`);
  console.log(` [PathfolioApp Backend API]`);
  console.log(` Server URL:   http://localhost:${config.port}/api/health`);
  console.log(` Environment:  ${config.nodeEnv}`);
  console.log(` Port:         ${config.port}`);
  console.log(`======================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[PathfolioApp API Error] Port ${config.port} is already in use.`);
    console.error(`Please close any existing process on port ${config.port} or configure PORT in api/.env\n`);
    process.exit(1);
  } else {
    console.error('[PathfolioApp API Server Error]:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  console.log('[PathfolioApp API] SIGTERM received: closing HTTP server');
  server.close(() => {
    console.log('[PathfolioApp API] HTTP server closed');
  });
});
}
start().catch(err => { console.error('[PathfolioApp] Unable to initialize persistence:', err.message); process.exit(1); });
