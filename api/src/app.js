const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const onboardingRoutes = require('./routes/onboarding.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors({
  origin: config.clientOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
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

// Mount Onboarding API
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/auth', require('./routes/auth.routes'));

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
