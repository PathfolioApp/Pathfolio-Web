const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  allowedDomains: (process.env.ALLOWED_INSTITUTION_DOMAINS || 'edu,ac.in,univ.edu').split(','),
  mockErpVerification: process.env.MOCK_ERP_VERIFICATION !== 'false'
};
