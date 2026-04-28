import { useState } from 'react';
import { useToast } from '../components/Toast.jsx';

export const ArchiveScreen = ({onNav, keywords = []}) => {
  const toast = useToast();
  const [showMore, setShowMore] = useState(false);
  const [filterYear, setFilterYear] = useState('2026');
  const [filterMonth, setFilterMonth] = useState('04');
  const [yearOpen, setYearOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);

  const today = 27;
  const keywordDays = 27;
  const grid = Array.from({length:98}, (_, i) => {
    if (i === today) return 'today';
    if (i > today) return 'future';
    const r = Math.sin(i*2.1) + Math.cos(i*0.7);
    return r > 0.3 ? 'on' : r > -0.5 ? 'on-light' : 'none';
  });

  const visibleKeywords = showMore ? keywords : keywords.slice(0, 10);

  const handleRead = (k) => {
    toast(`${k.word} · ${k.eng} — 글 목록으로 이동합니다`);
    onNav('feed', { keyword: k });
  };

  const handleTopKw = (word) => {
    toast(`${word} — 글 목록으로 이동합니다`);
    onNav('feed', { keyword: { word } });
  };

  const DropFilter = ({label, value, open, onToggle, options, onSelect}) => (
    <div style={{position:'relative'}}>
      <div className="tsel" style={{padding:'8px 12px', cursor:'pointer'}} onClick={onToggle}>
        {label} · {value} ▾
      </div>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:20,
          background:'var(--paper)', border:'1px solid var(--rule)', minWidth:100,
          boxShadow:'0 4px 16px rgba(0,0,0,0.08)',
        }}>
          {options.map(o => (
            <div key={o} onClick={() => { onSelect(o); onToggle(); }} style={{
              padding:'9px 14px', cursor:'pointer', fontFamily:'var(--f-mono)', fontSize:11,
              color: o === value ? 'var(--accent)' : 'var(--ink)',
              background: o === value ? 'var(--paper-2)' : 'transparent',
            }}
              onMouseEnter={e => e.currentTarget.style.background='var(--paper-2)'}
              onMouseLeave={e => e.currentTarget.style.background= o===value ? 'var(--paper-2)' : 'transparent'}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div onClick={() => { setYearOpen(false); setMonthOpen(false); }}>
      <div className="wrap" style={{paddingTop:36}}>
        <section style={{display:'grid', gridTemplateColumns:'1fr auto', gap:40, alignItems:'end', paddingBottom:24, borderBottom:'1px solid var(--rule)'}}>
          <div>
            <div className="eyebrow" style={{marginBottom:10}}>ARCHIVE · {keywordDays} DAYS · 428,932 WRITINGS</div>
            <h1 className="hero-title-xl" style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:56, letterSpacing:'-0.025em', lineHeight:1, margin:0, color:'var(--ink)'}}>키워드 아카이브</h1>
            <p style={{fontSize:14, color:'var(--ink-mute)', marginTop:14, maxWidth:'48ch', lineHeight:1.65}}>2026년 4월 1일부터 매일 하나씩, {keywordDays}개의 키워드가 쌓였습니다. 한 글자, 한 단어, 하나의 감정에 대한 기록.</p>
          </div>
          <div style={{display:'flex', gap:8}} onClick={e => e.stopPropagation()}>
            <DropFilter label="연도" value={filterYear} open={yearOpen}
              onToggle={() => { setYearOpen(v=>!v); setMonthOpen(false); }}
              options={['2025','2026']} onSelect={setFilterYear} />
            <DropFilter label="월" value={filterMonth} open={monthOpen}
              onToggle={() => { setMonthOpen(v=>!v); setYearOpen(false); }}
              options={['01','02','03','04','05','06','07','08','09','10','11','12']} onSelect={setFilterMonth} />
          </div>
        </section>

        <section style={{display:'grid', gridTemplateColumns:'420px 1fr', gap:56, paddingTop:32}}>
          <div>
            <div className="col-h">
              <h2>지난 98일</h2>
              <span className="meta">2026·04·01 → 04·27</span>
            </div>
            <div className="cal">
              {grid.map((s, i) => (
                <div key={i}
                  className={`d${s==='today'?' today':s==='future'?'':s==='on'?' on':s==='on-light'?' on-light':''}`}
                  style={{...(s==='future'?{opacity:0.25}:{}), ...(s!=='future'&&s!=='today'?{cursor:'pointer'}:{})}}
                  onClick={() => s !== 'future' && s !== 'today' && toast(`이 날의 키워드 글 보기`)}>
                  {s==='today'?'●':''}
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:14, marginTop:16, fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-mute)', alignItems:'center'}}>
              {[['var(--accent)','오늘'],['var(--ink)','작성함'],['var(--paper-3)','읽기만'],['transparent','미작성']].map(([bg,label], i) => (
                <span key={label} style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <span style={{width:10, height:10, background:bg, border:i===3?'1px solid var(--rule-ghost)':'none', display:'block'}}/>
                  {label}
                </span>
              ))}
            </div>

            <div style={{marginTop:32}}>
              <div className="col-h"><h2>가장 많이 쓴 키워드</h2></div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                {[['YOUTH','청춘',12],['MEMORY','기억',9],['DAWN','새벽',7],['SILENCE','침묵',6]].map(([e,k,n], i) => (
                  <div key={i} onClick={() => handleTopKw(k)} style={{border:'1px solid var(--rule-ghost)', padding:16, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer'}}>
                    <div>
                      <div className="meta" style={{fontSize:9.5}}>{e}</div>
                      <div style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:22, letterSpacing:'-0.02em'}}>{k}</div>
                    </div>
                    <div style={{fontFamily:'var(--f-latin)', fontWeight:700, fontSize:22, color:'var(--accent)', fontVariantNumeric:'tabular-nums'}}>
                      {n}<span style={{fontSize:11, color:'var(--ink-mute)', fontWeight:500, marginLeft:2}}>회</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="col-h">
              <h2>최근 키워드</h2>
              <span className="meta">DATE · WORD · WRITINGS</span>
            </div>
            {visibleKeywords.map((k, i) => (
              <div className="kw-row" key={i}>
                <span className="kdate">2026·{k.date}</span>
                <div>
                  <div className="kword">
                    <span className="kor-serif">{k.word}</span>
                    <span style={{marginLeft:14, color:'var(--ink-faint)', fontFamily:'var(--f-serif)', fontSize:14, letterSpacing:'0.08em'}}>{k.eng}</span>
                  </div>
                  <div className="meta" style={{fontSize:10.5, marginTop:2}}>
                    NO. {String(Math.max(1, keywordDays - i)).padStart(4,'0')} · {i===0 ? '작성함 ✓' : i%3!==0 ? '작성함 ✓' : '미작성 —'}
                  </div>
                </div>
                <div className="kcount">{k.count.toLocaleString()}<small>글</small></div>
                <div style={{textAlign:'right'}}>
                  <button className="btn sm ghost" onClick={() => handleRead(k)}>읽기 <span className="arr">→</span></button>
                </div>
              </div>
            ))}
            {!showMore && (
              <div style={{textAlign:'center', padding:'28px 0 8px'}}>
                <button className="btn ghost" onClick={() => setShowMore(true)}>
                  더 오래된 키워드 보기 <span className="arr">↓</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
