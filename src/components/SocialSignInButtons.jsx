import { useEffect, useRef, useState } from 'react';
import { loginWithGoogle } from '../lib/api.js';

const GOOGLE_WEB_CLIENT_ID = '666930356191-6er0i65ciom9jdu1vjtobu9op5qdeb1e.apps.googleusercontent.com';

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
  const [loading, setLoading] = useState(null); // 'google' | null

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      <div ref={googleBtnRef} style={{ minHeight: 44 }} />
    </div>
  );
};
