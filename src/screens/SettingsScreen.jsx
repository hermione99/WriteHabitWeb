import { useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import { CONTACT_EMAIL, CONTACT_MAILTO, PASSWORD_RESET_HELP_MAILTO } from '../lib/contact.js';

const Toggle = ({on, onClick, label, desc}) => (
  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)', gap:16}}>
    <div style={{minWidth:0}}>
      <div style={{fontFamily:'var(--f-kr)', fontSize:14, fontWeight:600, color:'var(--ink)'}}>{label}</div>
      {desc && <div style={{fontSize:12, color:'var(--ink-mute)', marginTop:2, lineHeight:1.5}}>{desc}</div>}
    </div>
    <button onClick={onClick} style={{
      width:38, height:22, borderRadius:11, border:'none', cursor:'pointer',
      background: on ? 'var(--ink)' : 'var(--paper-3)',
      position:'relative', flexShrink:0, transition:'background 0.15s',
    }}>
      <span style={{
        position:'absolute', top:2, left: on ? 18 : 2,
        width:18, height:18, borderRadius:'50%',
        background:'var(--paper)', transition:'left 0.15s',
      }}/>
    </button>
  </div>
);

const FONT_PRESETS = [
  {id:'1', name:'Gowun Batang + Pretendard', sub:'현재 · 부드럽고 가벼움'},
  {id:'2', name:'Maru Buri + Pretendard',     sub:'더 따뜻하고 일기 같은 느낌'},
  {id:'3', name:'Noto Serif KR + Pretendard', sub:'정돈된 출판물 느낌'},
  {id:'4', name:'KoPubWorld 바탕 + Spoqa',     sub:'클래식한 한국 잡지 느낌'},
];

export const SettingsScreen = ({onNav, user, prefs, onUpdatePrefs, dark, onToggleDark, onLogout, onExportData, onDeleteAccount}) => {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText]     = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== '삭제' || deleting) return;
    setDeleting(true);
    try {
      await onDeleteAccount();
      setConfirmDelete(false);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="wrap-narrow" style={{paddingTop:40, paddingBottom:80}}>
        <div className="eyebrow" style={{marginBottom:10}}>SETTINGS · 설정</div>
        <h1 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:44, letterSpacing:'-0.025em', lineHeight:1, margin:'0 0 12px', color:'var(--ink)'}}>설정</h1>
        <p style={{fontSize:14, color:'var(--ink-mute)', marginBottom:40, lineHeight:1.65}}>
          계정·알림·테마를 관리하고 데이터를 내보낼 수 있습니다.
        </p>

        {/* 계정 */}
        <section style={{marginBottom:48}}>
          <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:20, margin:'0 0 16px', color:'var(--ink)', paddingBottom:10, borderBottom:'1px solid var(--rule)'}}>계정</h2>
          <div style={{display:'grid', gridTemplateColumns:'140px 1fr', gap:16, padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)', alignItems:'center'}}>
            <div className="label" style={{fontSize:10}}>닉네임</div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
              <span style={{fontFamily:'var(--f-kr)', fontSize:14, color:'var(--ink)'}}>{user?.nickname || '—'}</span>
              <button className="btn sm ghost" onClick={() => onNav('profile')}>변경</button>
            </div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'140px 1fr', gap:16, padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)', alignItems:'center'}}>
            <div className="label" style={{fontSize:10}}>이메일</div>
            <span style={{fontFamily:'var(--f-mono)', fontSize:13, color:'var(--ink-soft)'}}>{user?.email || '—'}</span>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'140px 1fr', gap:16, padding:'14px 0', alignItems:'center'}}>
            <div className="label" style={{fontSize:10}}>비밀번호</div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
              <span style={{fontFamily:'var(--f-mono)', fontSize:13, color:'var(--ink-soft)'}}>············</span>
              <button className="btn sm ghost" onClick={() => toast('로그아웃 후 로그인 화면의 비밀번호 찾기에서 재설정할 수 있습니다.', 'info')}>변경</button>
            </div>
          </div>
        </section>

        {/* 알림 */}
        <section style={{marginBottom:48}}>
          <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:20, margin:'0 0 16px', color:'var(--ink)', paddingBottom:10, borderBottom:'1px solid var(--rule)'}}>알림</h2>
          <Toggle on={prefs.emailDigest} onClick={() => onUpdatePrefs({emailDigest: !prefs.emailDigest})}
            label="주간 이메일 다이제스트" desc="매주 월요일 아침, 한 주의 키워드와 인기 글을 보내드립니다." />
          <Toggle on={prefs.notifLike}    onClick={() => onUpdatePrefs({notifLike: !prefs.notifLike})}
            label="좋아요 알림" desc="누군가 내 글에 좋아요를 남기면 알려드립니다." />
          <Toggle on={prefs.notifComment} onClick={() => onUpdatePrefs({notifComment: !prefs.notifComment})}
            label="댓글 알림" desc="내 글이나 답글에 댓글이 달리면 알려드립니다." />
          <Toggle on={prefs.notifFollow}  onClick={() => onUpdatePrefs({notifFollow: !prefs.notifFollow})}
            label="팔로우 알림" desc="새 팔로워가 생기면 알려드립니다." />
          <Toggle on={prefs.notifSystem}  onClick={() => onUpdatePrefs({notifSystem: !prefs.notifSystem})}
            label="시스템 공지" desc="새 키워드 발행, 서비스 변경사항 등 운영 공지를 받습니다." />
        </section>

        {/* 테마 */}
        <section style={{marginBottom:48}}>
          <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:20, margin:'0 0 16px', color:'var(--ink)', paddingBottom:10, borderBottom:'1px solid var(--rule)'}}>테마</h2>
          <Toggle on={dark} onClick={onToggleDark}
            label="다크 모드" desc="밤에 글을 읽을 때 눈이 덜 피로합니다." />
        </section>

        {/* 데이터 */}
        <section style={{marginBottom:48}}>
          <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:20, margin:'0 0 16px', color:'var(--ink)', paddingBottom:10, borderBottom:'1px solid var(--rule)'}}>데이터</h2>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)', gap:16}}>
            <div>
              <div style={{fontFamily:'var(--f-kr)', fontSize:14, fontWeight:600, color:'var(--ink)'}}>내 데이터 내보내기</div>
              <div style={{fontSize:12, color:'var(--ink-mute)', marginTop:2}}>작성한 글·댓글·팔로우·차단 정보를 JSON으로 다운로드합니다.</div>
            </div>
            <button className="btn sm" onClick={onExportData}>다운로드 <span className="arr">↓</span></button>
          </div>
        </section>

        {/* 운영 안내 */}
        <section style={{marginBottom:48}}>
          <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:20, margin:'0 0 16px', color:'var(--ink)', paddingBottom:10, borderBottom:'1px solid var(--rule)'}}>운영 안내</h2>
          <div style={{padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)'}}>
            <div style={{fontFamily:'var(--f-kr)', fontSize:14, fontWeight:600, color:'var(--ink)'}}>베타 서비스</div>
            <div style={{fontSize:12, color:'var(--ink-mute)', marginTop:4, lineHeight:1.65}}>
              WriteHabit은 현재 베타 운영 중입니다. 기능, 화면, 데이터 구조는 안정화 과정에서 조정될 수 있습니다.
            </div>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)', gap:16}}>
            <div>
              <div style={{fontFamily:'var(--f-kr)', fontSize:14, fontWeight:600, color:'var(--ink)'}}>문의/피드백</div>
              <div style={{fontSize:12, color:'var(--ink-mute)', marginTop:2}}>{CONTACT_EMAIL}</div>
            </div>
            <a className="btn sm ghost" href={CONTACT_MAILTO} style={{textDecoration:'none'}}>메일 보내기</a>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)', gap:16}}>
            <div>
              <div style={{fontFamily:'var(--f-kr)', fontSize:14, fontWeight:600, color:'var(--ink)'}}>비밀번호 재설정</div>
              <div style={{fontSize:12, color:'var(--ink-mute)', marginTop:2}}>로그인 화면의 비밀번호 찾기에서 30분 유효한 재설정 링크를 받을 수 있습니다.</div>
            </div>
            <a className="btn sm ghost" href={PASSWORD_RESET_HELP_MAILTO} style={{textDecoration:'none'}}>도움 요청</a>
          </div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', gap:16}}>
            <div>
              <div style={{fontFamily:'var(--f-kr)', fontSize:14, fontWeight:600, color:'var(--ink)'}}>정책 문서</div>
              <div style={{fontSize:12, color:'var(--ink-mute)', marginTop:2}}>서비스 이용 전 약관과 개인정보 처리 내용을 확인할 수 있습니다.</div>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end'}}>
              <button className="btn sm ghost" onClick={() => onNav('terms')}>이용약관</button>
              <button className="btn sm ghost" onClick={() => onNav('privacy')}>개인정보</button>
            </div>
          </div>
        </section>

        {/* 위험 영역 */}
        <section style={{marginBottom:24, padding:20, border:'1px solid var(--accent)', background:'var(--accent-soft)'}}>
          <div className="eyebrow" style={{marginBottom:8, color:'var(--accent)'}}>DANGER ZONE · 위험 영역</div>
          <h3 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:18, margin:'0 0 8px', color:'var(--ink)'}}>계정 삭제</h3>
          <p style={{fontSize:13, color:'var(--ink-soft)', lineHeight:1.65, margin:'0 0 16px'}}>
            계정과 작성한 모든 글·댓글·팔로우·알림이 즉시 영구 삭제됩니다.<br/>
            이 작업은 되돌릴 수 없습니다.
          </p>
          <button className="btn sm" style={{borderColor:'var(--accent)', color:'var(--accent)'}}
            onClick={() => { setConfirmDelete(true); setConfirmText(''); }}>
            계정 삭제하기
          </button>
        </section>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:24}}>
          <button className="btn sm ghost" onClick={() => onNav('feed')}>← 돌아가기</button>
          <button className="btn sm" onClick={onLogout}>로그아웃</button>
        </div>
      </div>

      {/* 계정 삭제 확인 모달 */}
      {confirmDelete && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
          onClick={() => setConfirmDelete(false)}>
          <div style={{background:'var(--card)', border:'1px solid var(--accent)', borderRadius:4, padding:32, maxWidth:440, width:'100%', boxShadow:'0 16px 48px rgba(0,0,0,0.18)'}}
            onClick={e => e.stopPropagation()}>
            <div className="eyebrow" style={{marginBottom:8, color:'var(--accent)'}}>FINAL CONFIRMATION</div>
            <h3 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:22, letterSpacing:'-0.02em', margin:'0 0 12px', color:'var(--ink)'}}>
              정말 계정을 삭제할까요?
            </h3>
            <p style={{fontSize:13, color:'var(--ink-soft)', lineHeight:1.65, margin:'0 0 20px'}}>
              이 작업을 진행하면 다음 데이터가 즉시 삭제됩니다:<br/>
              · 작성한 모든 글과 댓글<br/>
              · 팔로우/팔로워 관계<br/>
              · 차단 목록과 알림<br/>
              · 프로필과 환경설정<br/>
              <strong style={{color:'var(--accent)'}}>되돌릴 수 없습니다.</strong>
            </p>
            <div style={{marginBottom:20}}>
              <div className="label" style={{fontSize:10, marginBottom:6}}>확인을 위해 <strong style={{color:'var(--accent)'}}>삭제</strong>를 입력하세요</div>
              <input className="field" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="삭제" autoFocus />
            </div>
            <div style={{display:'flex', justifyContent:'flex-end', gap:10}}>
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>취소</button>
              <button className="btn solid" disabled={confirmText !== '삭제' || deleting}
                onClick={handleDelete}
                style={{background: confirmText==='삭제' ? 'var(--accent)' : 'var(--paper-3)', borderColor:'transparent', cursor: confirmText==='삭제'?'pointer':'not-allowed'}}>
                {deleting ? '삭제 중…' : '영구 삭제 →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
