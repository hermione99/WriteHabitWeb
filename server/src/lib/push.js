import apn from '@parse/node-apn';
import { prisma } from './prisma.js';

/**
 * APNs provider — env에 키 4종이 모두 있어야 활성화.
 * 누락이면 sendPush()가 no-op으로 동작 (개발 편의 + 환경 분리).
 *
 *   APN_KEY_ID    - Apple Developer에서 만든 .p8 키의 Key ID (10자)
 *   APN_TEAM_ID   - 팀 ID (10자)
 *   APN_AUTH_KEY  - .p8 파일 내용 그대로 (BEGIN/END 줄 포함, 줄바꿈은 \n으로)
 *   APN_BUNDLE_ID - 앱 번들 ID (예: co.writehabit.app)
 *
 * 추가:
 *   APN_PRODUCTION = 'true' | 'false'  (기본: NODE_ENV === 'production')
 */
let providerSingleton = null;

const getProvider = () => {
  if (providerSingleton !== null) return providerSingleton;

  const keyId = process.env.APN_KEY_ID;
  const teamId = process.env.APN_TEAM_ID;
  const authKey = process.env.APN_AUTH_KEY;
  const bundleId = process.env.APN_BUNDLE_ID;

  if (!keyId || !teamId || !authKey || !bundleId) {
    console.warn(
      '[push] APN env vars missing — push disabled. ' +
      'Required: APN_KEY_ID, APN_TEAM_ID, APN_AUTH_KEY, APN_BUNDLE_ID'
    );
    providerSingleton = false;
    return false;
  }

  // .p8 텍스트 — Render 같은 호스트에선 \n이 literal로 들어올 수 있어 정규화.
  const normalizedKey = authKey.replace(/\\n/g, '\n');

  const isProd =
    process.env.APN_PRODUCTION === 'true' ||
    (process.env.APN_PRODUCTION !== 'false' &&
      process.env.NODE_ENV === 'production');

  providerSingleton = new apn.Provider({
    token: {
      key: normalizedKey,
      keyId,
      teamId,
    },
    production: isProd,
  });

  console.log(`[push] APN provider initialized (production=${isProd})`);
  return providerSingleton;
};

/**
 * 한 사용자에게 푸시 발송.
 * - 그 사용자의 모든 device 토큰을 가져와 동시에 발송
 * - APNs가 invalid 응답 (BadDeviceToken / Unregistered) 주면 DB에서 자동 제거
 *
 * @param {string} userId
 * @param {{ title: string, body?: string, data?: object, sound?: string, badge?: number }} payload
 */
export const sendPushToUser = async (userId, payload) => {
  const provider = getProvider();
  if (!provider) return;

  const devices = await prisma.device.findMany({
    where: { userId, platform: 'ios' },
    select: { token: true },
  });
  if (devices.length === 0) return;

  const note = new apn.Notification();
  note.alert = {
    title: payload.title,
    body: payload.body || '',
  };
  note.sound = payload.sound || 'default';
  if (typeof payload.badge === 'number') note.badge = payload.badge;
  note.payload = payload.data || {};
  note.topic = process.env.APN_BUNDLE_ID;
  note.expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24h
  note.pushType = 'alert';

  const tokens = devices.map((d) => d.token);
  try {
    const result = await provider.send(note, tokens);
    if (result.failed?.length) {
      const invalidTokens = [];
      for (const f of result.failed) {
        const reason = f.response?.reason || f.error?.message || '';
        // BadDeviceToken / Unregistered → 토큰이 더 이상 유효하지 않음
        if (
          reason === 'BadDeviceToken' ||
          reason === 'Unregistered' ||
          reason === 'DeviceTokenNotForTopic'
        ) {
          invalidTokens.push(f.device);
        } else {
          console.warn('[push] failed:', f.device, reason);
        }
      }
      if (invalidTokens.length) {
        await prisma.device.deleteMany({ where: { token: { in: invalidTokens } } });
        console.log(`[push] removed ${invalidTokens.length} invalid token(s)`);
      }
    }
  } catch (error) {
    console.error('[push] send error:', error);
  }
};
