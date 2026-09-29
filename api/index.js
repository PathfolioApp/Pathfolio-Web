/**
 * Vercel serverless entrypoint.
 * Wraps the existing Express app; sessions and stores initialize lazily on
 * the first invocation and are reused across warm invocations.
 */
const app = require('./src/app');
const store = require('./src/models/studentStore');
const adminContentStore = require('./src/models/adminContentStore');
const recruiterShareService = require('./src/modules/recruiters/recruiterShare.service');
const adminUserService = require('./src/services/adminUser.service');
const config = require('./src/config');

let ready = null;
async function initialize() {
  if (!ready) {
    ready = (async () => {
      await store.initialize();
      await adminContentStore.initialize();
      await recruiterShareService.initialize();
      await adminUserService.ensureBootstrapAdmin(config);
    })().catch(error => {
      ready = null; // allow retry on the next invocation
      throw error;
    });
  }
  return ready;
}

module.exports = async (req, res) => {
  try {
    await initialize();
  } catch (error) {
    console.error('[PathfolioApp] Initialization failed:', error.message);
    return res.status(503).json({ success: false, message: 'Service is warming up. Try again shortly.' });
  }
  return app(req, res);
};
