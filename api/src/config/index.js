const dotenv = require('dotenv');
dotenv.config();

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};
const boundedInt = (value, fallback, min, max) => Number.isFinite(Number(value)) && String(value ?? '').trim() !== ''
  ? Math.max(min, Math.min(max, Math.floor(Number(value)))) : fallback;

module.exports = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim()).filter(Boolean),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  allowedDomains: ['kiit.ac.in'],
  db: { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), name: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD },
  sessionSecret: process.env.SESSION_SECRET,
  // Shared API keys that machine clients (the separate frontend, curl, other
  // services) must present via `X-API-Key` or `Authorization: Bearer <key>`.
  // Empty list = gate disabled (local development); comma-separate multiple.
  apiKeys: (process.env.API_KEY || process.env.API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean),
  // Session cookie flags. SameSite must be 'none' + SESSION_COOKIE_SECURE=true
  // when the frontend lives on a different site than the API (separate-host
  // deployments), otherwise browsers drop the cross-site session cookie.
  sessionCookie: {
    sameSite: (process.env.SESSION_COOKIE_SAMESITE || 'lax').trim().toLowerCase(),
    secure: parseBool(process.env.SESSION_COOKIE_SECURE, process.env.NODE_ENV === 'production')
  },
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  bootstrapAdminName: process.env.BOOTSTRAP_ADMIN_NAME,
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
  databaseConfigured: (process.env.NODE_ENV === 'production' || process.env.USE_DATABASE === 'true') && Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER),
  // When true, registration requires clicking a time-limited email verification
  // link before the account is created. When false (dev-friendly default), the
  // institutional email format is still enforced but no verification mail is sent.
  strictEmailVerification: parseBool(process.env.STRICT_EMAIL_VERIFICATION, false),
  emailVerificationTokenTtlMinutes: Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES || 60),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: parseBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  },
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
  groqApiKey: process.env.GROQ_API_KEY?.trim() || null,
  groqModel: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b',
  // Generic AI provider for the recruitment intelligence features. Defaults to
  // reusing the free Gemini key when AI_* variables are not set, so no new paid
  // dependency is introduced. provider 'none' disables every AI call.
  storyAi: {
    dailyPerStudent: boundedInt(process.env.STORY_AI_DAILY_PER_STUDENT, 5, 1, 50),
    dailyCampus: boundedInt(process.env.STORY_AI_DAILY_CAMPUS, 1000, 1, 1000000),
    concurrency: boundedInt(process.env.STORY_AI_CONCURRENCY, 4, 1, 100),
    cooldownSeconds: boundedInt(process.env.STORY_AI_COOLDOWN_SECONDS, 60, 10, 86400),
    deadlineMs: boundedInt(process.env.STORY_AI_DEADLINE_MS, 20000, 1000, 20000),
    geminiModels: (process.env.STORY_AI_GEMINI_MODELS || 'gemini-3.5-flash-lite').split(',').map(v => v.trim()).filter(Boolean).slice(0, 2)
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'auto').trim().toLowerCase(), // auto | gemini | groq | openai-compatible | none
    apiKey: (process.env.AI_API_KEY || '').trim() || null,
    model: (process.env.AI_MODEL || '').trim() || null,
    baseUrl: (process.env.AI_BASE_URL || '').trim().replace(/\/+$/, '') || null
  }
};
