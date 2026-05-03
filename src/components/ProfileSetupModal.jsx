import { useEffect, useRef, useState } from 'react';
import { checkHandleAvailability, resolveAssetUrl, updateMyProfile, uploadAvatar } from '../lib/api.js';

/**
 * Shown after a social signup creates a new account so the user can pick a
 * proper handle / display name / avatar / bio before settling into the app.
 * The auto-generated handle from the backend is pre-filled so users who don't
 * want to customise can just hit "완료".
 */
export const ProfileSetupModal = ({ open, user, token, onComplete, onSkip }) => {
  const [displayName, setDisplayName] = useState(user?.nickname || '');
  const [handle, setHandle] = useState(user?.handle || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl ? resolveAssetUrl(user.avatarUrl) : '');
  const [handleStatus, setHandleStatus] = useState('ok'); // 'ok' | 'checking' | 'taken' | 'invalid'
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const initialHandleRef = useRef(user?.handle || '');

  useEffect(() => {
    if (!open) return;
    setDisplayName(user?.nickname || '');
    setHandle(user?.handle || '');
    setBio(user?.bio || '');
    setAvatarFile(null);
    setAvatarPreview(user?.avatarUrl ? resolveAssetUrl(user.avatarUrl) : '');
    setError('');
    setHandleStatus('ok');
    initialHandleRef.current = user?.handle || '';
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const value = handle.toLowerCase();
    if (value === initialHandleRef.current) {
      setHandleStatus('ok');
      return;
    }
    if (value.length < 3 || value.length > 20 || !/^[a-z][a-z0-9_]*$/.test(value)) {
      setHandleStatus('invalid');
      return;
    }
    setHandleStatus('checking');
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const result = await checkHandleAvailability(value);
        if (!cancelled) setHandleStatus(result.available ? 'ok' : (result.reason || 'taken'));
      } catch {
        if (!cancelled) setHandleStatus('ok');
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [handle, open]);

  if (!open) return null;

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => setAvatarPreview(evt.target?.result || '');
    reader.readAsDataURL(file);
  };

  const canSave = displayName.trim().length > 0 && handleStatus === 'ok' && !saving;

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      let avatarUrl;
      if (avatarFile) {
        const result = await uploadAvatar({ file: avatarFile, token });
        avatarUrl = result.url;
      }
      const trimmedBio = bio.trim();
      const updated = await updateMyProfile({
        displayName: displayName.trim(),
        handle: handle === initialHandleRef.current ? undefined : handle,
        bio: trimmedBio || null,
        avatarUrl,
        token,
      });
      onComplete?.(updated.user);
    } catch (e) {
      setError(e?.message || '저장에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusText = {
    checking: '확인 중…',
    taken: '이미 사용 중인 핸들입니다.',
    reserved: '예약된 핸들입니다.',
    invalid: '3~20자, 영문 소문자로 시작 + 영문/숫자/_만 사용 가능합니다.',
    ok: '',
  }[handleStatus];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--paper)', border: '1px solid var(--rule-soft)', borderRadius: 4,
          padding: '32px 32px 28px', maxWidth: 440, width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--f-kr-serif)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', marginBottom: 6 }}>
            환영합니다
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)' }}>프로필을 잠깐만 다듬어볼까요?</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: 88, height: 88, borderRadius: '50%',
              border: '1px solid var(--rule-soft)', background: 'var(--paper-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden', padding: 0,
            }}
          >
            {avatarPreview
              ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>사진 추가</span>}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarPick} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6, fontFamily: 'var(--f-mono)' }}>닉네임</div>
          <input
            className="field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="표시 이름"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6, fontFamily: 'var(--f-mono)' }}>핸들</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--ink-mute)' }}>@</span>
            <input
              className="field"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="프로필 주소"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ flex: 1 }}
            />
          </div>
          {handleStatusText && (
            <div style={{ marginTop: 6, fontSize: 11, color: handleStatus === 'checking' ? 'var(--ink-mute)' : '#c0392b' }}>
              {handleStatusText}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6, fontFamily: 'var(--f-mono)' }}>한 줄 소개 (선택)</div>
          <textarea
            className="field"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            placeholder="예) 매일 한 줄을 남기는 사람"
            style={{ resize: 'vertical', minHeight: 60 }}
          />
        </div>

        {error && (
          <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.3)', padding: '8px 12px', marginBottom: 16, borderRadius: 2, fontSize: 12, color: '#c0392b' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onSkip} disabled={saving} style={{ flex: 1, justifyContent: 'center', padding: '12px 16px' }}>
            나중에
          </button>
          <button type="button" className="btn solid" onClick={handleSave} disabled={!canSave} style={{ flex: 1, justifyContent: 'center', padding: '12px 16px', opacity: canSave ? 1 : 0.5 }}>
            {saving ? '저장 중…' : '완료'}
          </button>
        </div>
      </div>
    </div>
  );
};
