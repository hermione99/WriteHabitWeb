import { useEffect, useRef, useState } from 'react';
import { loginWithApple, loginWithGoogle } from '../lib/api.js';

const APPLE_SERVICES_ID = 'co.writehabit.web';
const GOOGLE_WEB_CLIENT_ID = '247995963053-kqt0ph21rh0okm020j5d0i0uu0jedilh.apps.googleusercontent.com';

const APPLE_SDK = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const GOOGLE_SDK = 'https://accounts.google.com/gsi/client';

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

export const SocialSignInButtons = ({ onLogin, remember = true, onError }) => {
  const googleBtnRef = useRef(null);
  const [loading, setLoading] = useState(null); // 'apple' | 'google' | null

  useEffect(() => {
    let mounted = true;
    loadScript(APPLE_SDK)
      .then(() => {
        if (!mounted || !window.AppleID) return;
        window.AppleID.auth.init({
          clientId: APPLE_SERVICES_ID,
          scope: 'name email',
          redirectURI: `${window.location.origin}/auth/apple/callback`,
          usePopup: true,
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadScript(GOOGLE_SDK)
      .then(() => {
        if (!mounted || !window.google?.accounts?.id || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(googleBtnRef.current.offsetWidth || 320, 400),
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCredential = async (resp) => {
    if (!resp?.credential) return;
    setLoading('google');
    try {
      const auth = await loginWithGoogle({ idToken: resp.credential });
      onLogin?.(auth, remember);
    } catch (e) {
      onError?.(e?.message || 'Google 로그인에 실패했습니다.');
    } finally {
      setLoading(null);
    }
  };

  const handleAppleClick = async () => {
    if (!window.AppleID) {
      onError?.('Apple 로그인 SDK를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setLoading('apple');
    try {
      const data = await window.AppleID.auth.signIn();
      const idToken = data?.authorization?.id_token;
      if (!idToken) throw new Error('Apple 인증 토큰을 받지 못했습니다.');
      const fullName = [data?.user?.name?.firstName, data?.user?.name?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const auth = await loginWithApple({ idToken, name: fullName || undefined });
      onLogin?.(auth, remember);
    } catch (e) {
      const code = e?.error;
      if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize') return;
      onError?.(e?.message || 'Apple 로그인에 실패했습니다.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      <button
        type="button"
        onClick={handleAppleClick}
        disabled={loading !== null}
        className="social-btn social-btn-apple"
        aria-label="Apple로 계속하기"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16.365 1.43c0 1.14-.41 2.18-1.23 3.13-.99 1.13-2.18 1.78-3.47 1.67-.04-.94.4-1.92 1.18-2.84.84-.95 2.05-1.65 3.52-1.96zM21 17.4c-.5 1.16-.74 1.68-1.39 2.71-.92 1.45-2.21 3.25-3.81 3.27-1.42.02-1.79-.93-3.71-.92-1.93.01-2.34.94-3.76.92-1.6-.02-2.83-1.65-3.74-3.1C1.85 15.93 1.59 11.07 4 8.6c1.14-1.18 2.78-1.84 4.36-1.84 1.61 0 2.62.88 3.95.88 1.29 0 2.07-.88 3.93-.88 1.41 0 2.91.77 3.98 2.1-3.5 1.92-2.93 6.93.78 8.54z"/>
        </svg>
        <span>{loading === 'apple' ? '로그인 중…' : 'Apple로 계속하기'}</span>
      </button>
      <div ref={googleBtnRef} style={{ minHeight: 44 }} />
    </div>
  );
};
