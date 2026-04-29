import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const parseOrigins = (value) => {
  if (!value) return ['http://127.0.0.1:5173', 'http://localhost:5173'];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  jwtSecret: process.env.JWT_SECRET || 'dev-writehabit-secret-change-before-deploy',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendOrigin: process.env.FRONTEND_ORIGIN || parseOrigins(process.env.CORS_ORIGIN)[0] || 'http://127.0.0.1:5173',
  resendApiKey: process.env.RESEND_API_KEY || '',
  passwordResetFrom: process.env.PASSWORD_RESET_FROM || 'WriteHabit <onboarding@resend.dev>',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'writehabit/avatars',
};

if (isProduction) {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.CORS_ORIGIN) missing.push('CORS_ORIGIN');

  if (missing.length) {
    throw new Error(`Missing required production env: ${missing.join(', ')}`);
  }

  if (env.jwtSecret === 'dev-writehabit-secret-change-before-deploy') {
    throw new Error('JWT_SECRET must be changed in production');
  }
}
