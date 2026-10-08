const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const errorHandler = require('./shared/errorHandler');
const { wrapRouter } = require('./shared/asyncHandler');
const log = require('./shared/logger');

// Domain modules, each owns its routes, controllers, services, and data access.
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const authRoutes = require('./modules/auth/auth.routes');
const profileRoutes = require('./modules/students/profile.routes');
const publicShareRoutes = require('./modules/students/publicShare.routes');
const storyRoutes = require('./modules/students/story.routes');
const settingsRoutes = require('./modules/students/settings.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const preferenceRoutes = require('./modules/preferences/preference.routes');
const resumeRoutes = require('./modules/resumes/resume.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const recruitmentRoutes = require('./modules/admin/recruitment.routes');
const recruiterRoutes = require('./modules/recruiters/recruiter.routes');
const recruiterRecruitmentRoutes = require('./modules/recruiters/recruitment.routes');
const recruiterHistoryRoutes = require('./modules/recruiters/recruitmentHistory.routes');
const opportunityRoutes = require('./modules/applications/opportunity.routes');

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by PathfolioApp.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv === 'development') {
  // Compact request log through the scoped logger for consistent line format.
  app.use(morgan(':method :url :status - :response-time ms', {
    stream: { write: message => log.api.info(message.trim()) }
  }));
}

// Healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    product: 'PathfolioApp API',
    version: '1.0.0',
    port: config.port,
    timestamp: new Date().toISOString()
  });
});

// Mount API modules (public URL contract is unchanged)
//
// Express 4 does not forward rejected promises from `async` handlers, so a
// single failed `await` (e.g. `read ECONNRESET` from a recycled MySQL socket)
// escaped as an unhandled rejection and killed the process. `wrapRouter`
// rewrites each registered handler to hand its rejection to `next(err)`, which
// lands in the error handler below instead of the crash dump. Mounting happens
// after wrapping because a mounted sub-router is referenced by its parent layer.
for (const router of [onboardingRoutes, authRoutes, profileRoutes, publicShareRoutes, storyRoutes, settingsRoutes, notificationRoutes, preferenceRoutes, resumeRoutes, adminRoutes, recruitmentRoutes, recruiterRoutes, recruiterRecruitmentRoutes, recruiterHistoryRoutes, opportunityRoutes]) {
  wrapRouter(router);
}

app.use('/api/onboarding', onboardingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/public-profile', publicShareRoutes);
app.use('/api/story', storyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/preference', preferenceRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/recruitment', recruitmentRoutes);
app.use('/api/recruiter', recruiterRoutes);
app.use('/api/recruiter/recruitment', recruiterRecruitmentRoutes);
app.use('/api/recruiter/recruitment', recruiterHistoryRoutes);
app.use('/api/opportunities', opportunityRoutes);

// 404 Handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found on PathfolioApp API.`
  });
});

// Error handling middleware
app.use(errorHandler);

// Cover handlers registered directly on the app (health, 404) and any added
// later, so a rejected promise can never escape the Express stack again.
wrapRouter(app._router);

module.exports = app;
