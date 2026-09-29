const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const errorHandler = require('./shared/errorHandler');
const log = require('./shared/logger');

// Domain modules, each owns its routes, controllers, services, and data access.
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const authRoutes = require('./modules/auth/auth.routes');
const profileRoutes = require('./modules/students/profile.routes');
const settingsRoutes = require('./modules/students/settings.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const preferenceRoutes = require('./modules/preferences/preference.routes');
const resumeRoutes = require('./modules/resumes/resume.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const recruiterRoutes = require('./modules/recruiters/recruiter.routes');
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
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/preference', preferenceRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recruiter', recruiterRoutes);
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

module.exports = app;
