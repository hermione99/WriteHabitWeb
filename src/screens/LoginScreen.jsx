import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo.jsx';
import { useToast } from '../components/Toast.jsx';
import { API_ORIGIN, checkHandleAvailability, login, register } from '../lib/api.js';
import { checkHandleAvailable as checkLocalHandleAvailable, sanitizeHandle } from '../lib/handles.js';

const DEMO_EMAIL    = 'minji@writehabit.kr';
const DEMO_PASSWORD = 'writehabit';

/* Defined outside LoginScreen so React never remounts it on re-render */
const LoginField = ({id, label, type='text', value, onChange, placeholder, err, autoComplete, onClearError}) => (
  <div style={{marginBottom: err ? 8 : 20}}>
    <div className="label" style={{fontSize:10, marginBottom:6}}>{label}</div>
    <input
      className={`field${err ? ' error' : ''}`}
      type={type} value={value} onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete || id}
      onFocus={onClearError}
    />
    {err && <span className="field-err">{err}</span>}
  </div>
);

export const LoginScreen = ({onLogin, todayKw, stats, knownHandles = []}) => {
  const toast = useToast();

  /* mode: 'login' | 'signup' | 'reset' */
  const [mode, setMode]           = useState('login');

  /* fields */
  const [nickname, setNickname]   = useState('');
  const [email, setEmail]         = useState('');
  const [pass, setPass]           = useState('');
  const [passConfirm, setPassCfm] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  /* checkbox */
  const [remember, setRemember]   = useState(true);

  /* state */
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState({});

  /* clear errors on mode switch */
  const switchMode = (m) => { setMode(m); setErrors({}); setPass(''); setPassCfm(''); };

  /* nickname → URL handle (한글 보존, 공백·특수문자만 제거) */
  const handlePreview = sanitizeHandle(nickname);

  /* nickname uniqueness check (debounced) */
  const [nickStatus, setNickStatus] = useState('idle'); // 'idle'|'checking'|'ok'|'taken'|'invalid'|'reserved'
  useEffect(() => {
    if (mode !== 'signup') return;
    if (!handlePreview || handlePreview.length < 2) { setNickStatus('idle'); return; }
    setNickStatus('checking');
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const result = await checkHandleAvailability(handlePreview);
        if (!cancelled) {
          setNickStatus(result.available ? 'ok' : result.reason || 'taken');
        }
      } catch {
        const fallback = await checkLocalHandleAvailable(handlePreview, undefined, knownHandles);
        if (!cancelled) setNickStatus(fallback);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [handlePreview, mode]);

  /* ── validation ── */
  const validate = () => {
    const e = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (mode === 'signup') {
      const n = nickname.trim();
      if (!n)                        e.nickname = '닉네임을 입력해주세요.';
      else if (n.length < 2)         e.nickname = '닉네임은 2자 이상이어야 합니다.';
      else if (n.length > 20)        e.nickname = '닉네임은 20자 이하여야 합니다.';
      else if (!handlePreview)       e.nickname = '한글·영문·숫자를 포함해주세요.';
      else if (nickStatus === 'taken')   e.nickname = '이미 사용 중인 닉네임입니다.';
      else if (nickStatus === 'reserved') e.nickname = '예약된 닉네임입니다.';
      else if (nickStatus === 'invalid') e.nickname = '사용할 수 없는 닉네임입니다.';
      else if (nickStatus === 'checking') e.nickname = '닉네임 확인 중입니다…';
    }

    if (!email.trim())               e.email = '이메일을 입력해주세요.';
    else if (!emailRe.test(email))   e.email = '올바른 이메일 형식이 아닙니다.';

    if (!pass)                       e.pass = '비밀번호를 입력해주세요.';
    else if (pass.length < 8)        e.pass = '비밀번호는 8자 이상이어야 합니다.';

    if (mode === 'signup') {
      if (!passConfirm)              e.passConfirm = '비밀번호를 한 번 더 입력해주세요.';
      else if (pass !== passConfirm) e.passConfirm = '비밀번호가 일치하지 않습니다.';
    }
    return e;
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const auth = mode === 'login'
        ? await login({ email, password: pass })
        : await register({
            email,
            password: pass,
            handle: handlePreview || sanitizeHandle(email.split('@')[0]),
            displayName: nickname.trim() || email.split('@')[0],
          });

      onLogin(auth, remember);
      toast(mode === 'signup' ? '가입이 완료되었습니다.' : '로그인되었습니다.');
    } catch (error) {
      const messageByStatus = {
        401: '이메일 또는 비밀번호가 올바르지 않습니다.',
        409: error.message,
        503: '서버는 켜져 있지만 데이터베이스 연결이 아직 준비되지 않았습니다.',
      };
      setErrors({ form: messageByStatus[error.status] || error.message || '잠시 후 다시 시도해주세요.' });
    } finally {
      setLoading(false);
    }
  };

  /* ── reset password submit ── */
  const handleReset = (e) => {
    e.preventDefault();
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!resetEmail || !emailRe.test(resetEmail)) {
      setErrors({ resetEmail: '올바른 이메일을 입력해주세요.' });
      return;
    }
    setLoading(true);
    setTimeout(() => { setLoading(false); setResetSent(true); }, 800);
  };

  /* ── social stub ── */
  const handleSocial = (provider) => {
    toast(`${provider} 로그인은 준비 중입니다.`, 'info');
  };

  const clearErr = (id) => setErrors(prev => ({...prev, [id]: undefined, form: undefined}));

  return (
    <div className="login-grid">
      {/* LEFT — keyword panel */}
      <aside className="login-left">
        <Logo />
        <div>
          <div className="eyebrow" style={{marginBottom:14}}>오늘의 키워드 · {todayKw.dateStr} · NO. {todayKw.no}</div>
          <div style={{fontFamily:'var(--f-kw)', fontWeight:700, fontSize:96, letterSpacing:'-0.03em', lineHeight:0.95, color:'var(--ink)'}}>{todayKw.word}</div>
          <div style={{fontFamily:'var(--f-serif)', fontSize:28, color:'var(--ink-faint)', letterSpacing:'0.05em', marginTop:4}}>{todayKw.eng}</div>
          <p style={{fontFamily:'var(--f-kr-serif)', fontSize:17, lineHeight:1.8, color:'var(--ink-soft)', marginTop:36, maxWidth:'36ch'}}>
            하루에 한 번,<br/>하나의 키워드에<br/>당신의 문장을 남겨보세요.
          </p>
          <div style={{display:'flex', gap:40, marginTop:56, paddingTop:24, borderTop:'1px solid var(--rule-soft)'}}>
            {[
              [stats?.serviceDays ?? todayKw.no.replace(/^0+/,''), '일째'],
              [(stats?.users ?? 0).toLocaleString(), '명의 작가'],
              [(stats?.posts ?? 0).toLocaleString(), '편의 글'],
            ].map(([n,l]) => (
              <div key={l}>
                <div style={{fontFamily:'var(--f-latin)', fontWeight:700, fontSize:24, letterSpacing:'-0.03em', color:'var(--ink)'}}>{n}</div>
                <div className="meta" style={{fontSize:10.5, marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="meta" style={{fontSize:10.5}}>© 2026 WriteHabit · v1.0.2</div>
      </aside>

      {/* RIGHT — form */}
      <main className="login-right">
        <div style={{maxWidth:380}}>

          {/* ── RESET PASSWORD MODE ── */}
          {mode === 'reset' ? (<>
            <button onClick={() => { setMode('login'); setErrors({}); setResetSent(false); setResetEmail(''); }}
              style={{background:'none', border:'none', cursor:'pointer', fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-mute)', marginBottom:24, padding:0, display:'flex', alignItems:'center', gap:6}}>
              ← 로그인으로 돌아가기
            </button>
            <div className="eyebrow" style={{marginBottom:12}}>RESET · 비밀번호 찾기</div>
            <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:36, letterSpacing:'-0.025em', lineHeight:1.1, margin:'0 0 10px', color:'var(--ink)'}}>
              비밀번호를<br/>재설정합니다.
            </h2>
            <p style={{color:'var(--ink-mute)', fontSize:14, margin:'0 0 32px', lineHeight:1.65}}>
              가입 시 사용한 이메일을 입력하면<br/>재설정 링크를 보내드립니다.
            </p>

            {resetSent ? (
              <div className="reset-panel">
                <div style={{fontFamily:'var(--f-kr-serif)', fontSize:18, fontWeight:700, marginBottom:8, color:'var(--ink)'}}>이메일을 보냈습니다 ✓</div>
                <div style={{fontSize:13, color:'var(--ink-mute)', lineHeight:1.65}}>
                  <strong style={{color:'var(--ink)'}}>{resetEmail}</strong>으로<br/>
                  재설정 링크가 발송되었습니다.<br/>
                  메일함을 확인해주세요.
                </div>
              </div>
            ) : (
              <form onSubmit={handleReset}>
                <LoginField id="resetEmail" label="01 · EMAIL" type="email"
                  value={resetEmail} onChange={e=>setResetEmail(e.target.value)}
                  placeholder="가입 시 사용한 이메일" err={errors.resetEmail}
                  onClearError={() => clearErr('resetEmail')} />
                <div style={{marginBottom:20}} />
                <button type="submit" className="btn solid" disabled={loading}
                  style={{width:'100%', justifyContent:'center', padding:'14px 20px', fontSize:13, opacity: loading ? 0.7 : 1}}>
                  {loading ? <span className="spinner"/> : <>링크 전송 <span className="arr">→</span></>}
                </button>
              </form>
            )}
          </>) : (<>

            {/* ── LOGIN / SIGNUP MODE ── */}
            <div className="eyebrow" style={{marginBottom:12}}>{mode==='signup' ? 'SIGNUP · 회원가입' : 'LOGIN · 로그인'}</div>
            <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:40, letterSpacing:'-0.025em', lineHeight:1.1, margin:'0 0 10px', color:'var(--ink)'}}>
              {mode==='signup' ? <>처음 오셨군요.<br/>반갑습니다.</> : <>다시 만나서<br/>반갑습니다.</>}
            </h2>
            <p style={{color:'var(--ink-mute)', fontSize:14, margin:'0 0 32px'}}>
              {mode==='signup' ? '지금 가입하고 오늘의 글을 써보세요.' : '어제의 당신이 남긴 글이 기다리고 있어요.'}
            </p>

            {/* global form error */}
            {errors.form && (
              <div style={{background:'rgba(192,57,43,0.08)', border:'1px solid rgba(192,57,43,0.3)', padding:'10px 14px', marginBottom:20, borderRadius:2}}>
                <span style={{fontFamily:'var(--f-kr)', fontSize:13, color:'#c0392b'}}>{errors.form}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {mode==='signup' && (
                <>
                  <LoginField id="nickname" label="01 · 닉네임 (필명)"
                    value={nickname} onChange={e=>setNickname(e.target.value)}
                    placeholder="예) 달밤, moonchild, 새벽세시"
                    err={errors.nickname}
                    onClearError={() => clearErr('nickname')} />
                  <div style={{
                    margin:'-12px 0 18px', display:'flex', justifyContent:'space-between',
                    alignItems:'center', gap:8, fontSize:11, color:'var(--ink-mute)',
                    fontFamily:'var(--f-mono)',
                  }}>
                    <span>
                      {nickStatus === 'checking' && handlePreview ? '닉네임 확인 중…'
                       : nickStatus === 'taken'  ? <span style={{color:'#c0392b'}}>이미 사용 중인 닉네임입니다.</span>
                       : nickStatus === 'reserved' ? <span style={{color:'#c0392b'}}>예약된 닉네임입니다.</span>
                       : nickStatus === 'invalid' ? <span style={{color:'#c0392b'}}>사용할 수 없는 닉네임입니다.</span>
                       : nickStatus === 'ok'     ? <span style={{color:'var(--accent)'}}>사용 가능한 닉네임입니다 ✓</span>
                       : '본명이 아니어도 좋아요. 글에 작가 이름으로 표시됩니다.'}
                    </span>
                    {handlePreview && (
                      <span style={{
                        whiteSpace:'nowrap',
                        color: ['taken', 'reserved', 'invalid'].includes(nickStatus) ? '#c0392b'
                             : nickStatus === 'ok'    ? 'var(--accent)'
                             : 'var(--ink-mute)',
                      }}>@{handlePreview}</span>
                    )}
                  </div>
                </>
              )}
              <LoginField id="email" label={mode==='signup' ? '02 · 이메일' : '01 · EMAIL'} type="email"
                value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="your@email.com" err={errors.email}
                onClearError={() => clearErr('email')} />
              <LoginField id="pass" label={mode==='signup' ? '03 · 비밀번호' : '02 · PASSWORD'} type="password"
                value={pass} onChange={e=>setPass(e.target.value)}
                placeholder={mode==='signup' ? '8자 이상' : '비밀번호'} err={errors.pass}
                autoComplete={mode==='signup' ? 'new-password' : 'current-password'}
                onClearError={() => clearErr('pass')} />
              {mode==='signup' && (
                <LoginField id="passConfirm" label="04 · 비밀번호 확인" type="password"
                  value={passConfirm} onChange={e=>setPassCfm(e.target.value)}
                  placeholder="비밀번호 재입력" err={errors.passConfirm}
                  autoComplete="new-password"
                  onClearError={() => clearErr('passConfirm')} />
              )}

              {/* remember + forgot — login only */}
              {mode==='login' && (
                <div className="login-options-row" style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:28, fontSize:12}}>
                  <label style={{display:'inline-flex', alignItems:'center', gap:8, color:'var(--ink-soft)', cursor:'pointer', userSelect:'none'}}
                    onClick={() => setRemember(r=>!r)}>
                    <span className={`cb-box${remember?' checked':''}`}>{remember?'✓':''}</span>
                    로그인 상태 유지
                  </label>
                  <button className="login-forgot-link" type="button" onClick={() => setMode('reset')}
                    style={{background:'none', border:'none', cursor:'pointer', color:'var(--ink-mute)', textDecoration:'underline', textUnderlineOffset:3, fontSize:12, whiteSpace:'nowrap', padding:0}}>
                    비밀번호 찾기
                  </button>
                </div>
              )}
              {mode==='signup' && <div style={{marginBottom:28}}/>}

              <button type="submit" className="btn solid" disabled={loading}
                style={{width:'100%', justifyContent:'center', padding:'14px 20px', fontSize:13, opacity: loading ? 0.7 : 1}}>
                {loading
                  ? <><span className="spinner"/> &nbsp;{mode==='signup'?'가입 중…':'로그인 중…'}</>
                  : <>{mode==='signup'?'가입하기':'로그인'} <span className="arr">→</span></>
                }
              </button>

              {mode==='login' && (
                <p style={{marginTop:12, fontSize:11.5, color:'var(--ink-faint)', textAlign:'center', fontFamily:'var(--f-mono)'}}>
                  API 서버: {API_ORIGIN}
                </p>
              )}
            </form>

            <div style={{display:'flex', alignItems:'center', gap:12, margin:'24px 0', color:'var(--ink-faint)', fontFamily:'var(--f-mono)', fontSize:10.5}}>
              <span style={{flex:1, height:1, background:'var(--rule-soft)'}}/>
              <span>OR</span>
              <span style={{flex:1, height:1, background:'var(--rule-soft)'}}/>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <button className="btn" style={{justifyContent:'center'}} onClick={() => handleSocial('Google')}>Google</button>
              <button className="btn" style={{justifyContent:'center'}} onClick={() => handleSocial('Apple')}>Apple</button>
            </div>
            <p style={{marginTop:28, fontSize:12.5, color:'var(--ink-mute)', textAlign:'center'}}>
              {mode==='signup' ? '이미 계정이 있으신가요? ' : '아직 계정이 없으신가요? '}
              <button onClick={() => switchMode(mode==='signup'?'login':'signup')}
                style={{background:'none', border:'none', color:'var(--ink)', fontWeight:600, textDecoration:'underline', textUnderlineOffset:3, cursor:'pointer', fontSize:12.5}}>
                {mode==='signup' ? '로그인' : '회원가입'}
              </button>
            </p>
          </>)}

        </div>
      </main>
    </div>
  );
};
