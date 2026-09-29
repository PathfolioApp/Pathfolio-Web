const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim()).filter(Boolean),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  allowedDomains: ['kiit.ac.in'],
  db: { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), name: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD },
  sessionSecret: process.env.SESSION_SECRET,
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  bootstrapAdminName: process.env.BOOTSTRAP_ADMIN_NAME,
  bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase(),
  cloudinary: { cloudName: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET, uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'pathfolio/tnp', configured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME,
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION || 'auto',
    publicUrl: process.env.R2_PUBLIC_URL,
    configured: Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID) && (process.env.R2_BUCKET || process.env.R2_BUCKET_NAME))
  },
  databaseConfigured: (process.env.NODE_ENV === 'production' || process.env.USE_DATABASE === 'true') && Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER)
};
