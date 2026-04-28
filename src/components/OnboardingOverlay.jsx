import { useEffect, useState } from 'react';

const ONBOARDING_STEPS = [
  {
    eyebrow: '01 · WELCOME',
    title: '환영합니다.',
    body: '하루에 한 번, 하나의 키워드. 오늘부터 매일 한 줄을 남겨보세요.\n\n344일째, 28,419명이 이미 쓰고 있습니다.',
    cta: '시작하기',
  },
  {
    eyebrow: '02 · TODAY',
    title: '오늘의 키워드',
    body: '매일 자정, 새로운 키워드가 발행됩니다.\n그 키워드를 주제로 자유롭게 글을 써보세요. 길이도 형식도 자유입니다.',
    cta: '다음',
  },
  {
    eyebrow: '03 · WRITE',
    title: '글쓰기',
    body: '제목과 본문만 있으면 충분합니다. 작성 중인 글은 자동 저장되고,\n⌘+Enter로 빠르게 발행할 수 있어요.\n\n발행 후에도 언제든 수정·삭제할 수 있습니다.',
    cta: '다음',
  },
  {
    eyebrow: '04 · STREAK',
    title: '쌓이는 기록',
    body: '매일 한 줄이 한 달이 되고, 한 해가 됩니다.\n프로필에서 연속 작성 기록과 키워드 아카이브를 확인할 수 있어요.',
    cta: '오늘의 키워드로 →',
  },
];

export const OnboardingOverlay = ({ onDone, onSkip, onNav }) => {
  const [step, setStep] = useState(0);
  const currentStep = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  const next = () => {
    if (isLast) {
      onDone();
      onNav('write');
      return;
    }
    setStep(step + 1);
  };

  const prev = () => setStep(Math.max(0, step - 1));

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:400,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <div style={{
        background:'var(--paper)', border:'1px solid var(--rule-soft)',
        maxWidth:480, width:'100%', padding:'48px 40px 32px',
        boxShadow:'0 20px 60px rgba(0,0,0,0.25)', position:'relative',
      }}>
        <button onClick={onSkip} style={{
          position:'absolute', top:14, right:16, background:'none', border:'none',
          color:'var(--ink-mute)', cursor:'pointer', fontSize:11, fontFamily:'var(--f-mono)',
          letterSpacing:'0.1em',
        }}>SKIP →</button>

        <div className="eyebrow" style={{marginBottom:14}}>{currentStep.eyebrow}</div>
        <h2 style={{
          fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:38,
          letterSpacing:'-0.025em', lineHeight:1.1, margin:'0 0 16px', color:'var(--ink)',
        }}>{currentStep.title}</h2>
        <p style={{
          fontFamily:'var(--f-kr-serif)', fontSize:15.5, lineHeight:1.85,
          color:'var(--ink-soft)', whiteSpace:'pre-line', margin:'0 0 36px',
        }}>{currentStep.body}</p>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12}}>
          <div style={{display:'flex', gap:8}}>
            {ONBOARDING_STEPS.map((_, index) => (
              <span key={index} style={{
                width: index === step ? 18 : 6, height:6, borderRadius:3,
                background: index === step ? 'var(--ink)' : 'var(--paper-3)',
                transition:'width 0.2s, background 0.2s',
              }}/>
            ))}
          </div>
          <div style={{display:'flex', gap:8}}>
            {step > 0 && <button className="btn sm ghost" onClick={prev}>← 이전</button>}
            <button className="btn sm solid" onClick={next}>{currentStep.cta}</button>
          </div>
        </div>

        <div className="meta" style={{fontSize:9.5, marginTop:18, textAlign:'center', color:'var(--ink-faint)'}}>
          ← / → 키로 이동 · Esc로 건너뛰기
        </div>
      </div>
    </div>
  );
};
