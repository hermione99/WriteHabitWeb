import { Logo } from '../components/Logo.jsx';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '../lib/contact.js';

const sections = {
  terms: {
    eyebrow: 'TERMS · 이용약관',
    title: 'WriteHabit 이용약관',
    updated: '시행일 · 2026·04·29',
    intro: 'WriteHabit은 매일 하나의 키워드로 글을 쓰고 읽는 베타 서비스입니다. 기능과 정책은 안정화 과정에서 변경될 수 있으며, 중요한 변경은 서비스 내 안내로 공지합니다.',
    items: [
      ['계정', '사용자는 본인의 이메일과 비밀번호로 계정을 만들고 관리합니다. 타인의 계정을 무단으로 사용하거나 허위 정보를 등록해서는 안 됩니다.'],
      ['콘텐츠', '사용자가 작성한 글의 권리는 작성자에게 있습니다. 다만 서비스 운영, 표시, 백업, 신고 처리에 필요한 범위에서 WriteHabit이 콘텐츠를 처리할 수 있습니다.'],
      ['커뮤니티 기준', '타인을 괴롭히거나 혐오, 위협, 불법 정보, 스팸을 포함한 콘텐츠는 제한될 수 있습니다. 신고된 글은 운영자가 검토하여 숨김 또는 복구 처리할 수 있습니다.'],
      ['서비스 변경', '베타 기간에는 기능, 화면, 데이터 구조가 개선을 위해 변경될 수 있습니다. 중요한 변경은 서비스 내 공지 또는 별도 안내로 알립니다.'],
      ['문의/피드백', `계정, 콘텐츠, 신고, 약관 관련 문의는 ${CONTACT_EMAIL}로 보내주세요. 베타 기간에는 오류 제보와 사용 피드백도 같은 주소로 받습니다.`],
    ],
  },
  privacy: {
    eyebrow: 'PRIVACY · 개인정보처리방침',
    title: 'WriteHabit 개인정보처리방침',
    updated: '시행일 · 2026·04·29',
    intro: 'WriteHabit은 서비스 제공에 필요한 최소한의 개인정보를 처리합니다. 현재는 베타 운영 중이며, 기능 안정화에 따라 처리 항목과 방식이 조정될 수 있습니다.',
    items: [
      ['수집 항목', '이메일, 닉네임, 비밀번호 해시, 프로필 정보, 작성 글, 임시저장 글, 좋아요, 북마크, 팔로우, 차단, 신고 정보, 알림 정보, 비밀번호 재설정 토큰 정보가 저장될 수 있습니다.'],
      ['이용 목적', '회원 식별, 로그인, 비밀번호 재설정, 글 작성과 공개, 프로필 표시, 알림 제공, 신고 처리, 서비스 안정성 개선을 위해 사용합니다.'],
      ['보관 기간', '계정이 유지되는 동안 데이터를 보관합니다. 계정 삭제 요청 시 법령상 보관이 필요한 정보를 제외하고 서비스 데이터 삭제를 진행합니다.'],
      ['제3자 제공', '사용자 동의 또는 법령상 요청이 있는 경우를 제외하고 개인정보를 제3자에게 판매하거나 임의 제공하지 않습니다.'],
      ['처리 인프라', '서비스 운영을 위해 Vercel, Render, Neon 등 클라우드 인프라가 사용될 수 있으며, 각 서비스는 데이터 저장과 전송을 위한 기술적 처리자 역할을 합니다.'],
      ['사용자 권리', `사용자는 본인의 프로필을 수정하고, 계정 삭제와 데이터 내보내기를 요청하거나 앱 내 기능으로 수행할 수 있습니다. 개인정보 관련 문의는 ${CONTACT_EMAIL}로 보내주세요.`],
    ],
  },
};

export const LegalScreen = ({ type = 'terms', onNav }) => {
  const content = sections[type] || sections.terms;

  return (
    <div>
      <div className="wrap" style={{paddingTop:36, maxWidth:920}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:20, paddingBottom:28, borderBottom:'1px solid var(--rule)'}}>
          <Logo onClick={() => onNav('feed')} small />
          <button className="btn sm ghost" onClick={() => onNav('feed')}>돌아가기</button>
        </div>

        <section style={{padding:'44px 0 28px', borderBottom:'1px solid var(--rule-soft)'}}>
          <div className="eyebrow" style={{marginBottom:12}}>{content.eyebrow}</div>
          <h1 className="hero-title-xl" style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:48, letterSpacing:'-0.025em', lineHeight:1.05, margin:'0 0 14px', color:'var(--ink)'}}>
            {content.title}
          </h1>
          <div className="meta" style={{fontSize:11, marginBottom:20}}>{content.updated}</div>
          <p style={{fontSize:15, color:'var(--ink-mute)', lineHeight:1.75, maxWidth:'64ch', margin:0}}>
            {content.intro}
          </p>
        </section>

        <section style={{padding:'28px 0 48px'}}>
          {content.items.map(([title, body], index) => (
            <article key={title} style={{display:'grid', gridTemplateColumns:'88px 1fr', gap:24, padding:'22px 0', borderBottom:'1px solid var(--rule-ghost)'}}>
              <div className="meta" style={{fontSize:11}}>0{index + 1}</div>
              <div>
                <h2 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:22, letterSpacing:'-0.02em', margin:'0 0 8px', color:'var(--ink)'}}>
                  {title}
                </h2>
                <p style={{fontSize:14, color:'var(--ink-soft)', lineHeight:1.75, margin:0}}>
                  {body}
                </p>
              </div>
            </article>
          ))}
          <div style={{padding:'24px 0 0'}}>
            <a className="btn sm solid" href={CONTACT_MAILTO} style={{display:'inline-flex', textDecoration:'none'}}>
              문의/피드백 보내기 <span className="arr">→</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};
