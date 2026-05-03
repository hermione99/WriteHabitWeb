import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export const verifyAppleIdToken = async (idToken) => {
  const audiences = [env.appleServicesId, env.appleBundleId].filter(Boolean);
  if (audiences.length === 0) {
    throw new Error('Apple sign-in not configured: APPLE_SERVICES_ID / APPLE_BUNDLE_ID missing');
  }
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: audiences,
  });
  return {
    sub: payload.sub,
    email: payload.email || null,
    emailVerified:
      payload.email_verified === true ||
      payload.email_verified === 'true' ||
      false,
    isPrivateEmail:
      payload.is_private_email === true ||
      payload.is_private_email === 'true' ||
      false,
  };
};

export const verifyGoogleIdToken = async (idToken) => {
  const audiences = [env.googleWebClientId, env.googleIosClientId].filter(Boolean);
  if (audiences.length === 0) {
    throw new Error('Google sign-in not configured: GOOGLE_WEB_CLIENT_ID / GOOGLE_IOS_CLIENT_ID missing');
  }
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: audiences,
  });
  return {
    sub: payload.sub,
    email: payload.email || null,
    emailVerified: payload.email_verified === true,
    name: payload.name || null,
    picture: payload.picture || null,
  };
};
