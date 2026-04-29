import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import { getMyStreak } from '../lib/api.js';
import { readString } from '../lib/storage.js';

const formatMonthDay = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${String(value.getMonth() + 1).padStart(2, '0')}·${String(value.getDate()).padStart(2, '0')}`;
};

const formatYearMonthDay = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}·${String(value.getMonth() + 1).padStart(2, '0')}·${String(value.getDate()).padStart(2, '0')}`;
};

const getKeywordYear = (keyword) => keyword.startsAt ? String(new Date(keyword.startsAt).getFullYear()) : '2026';
const getKeywordMonth = (keyword) => keyword.startsAt
  ? String(new Date(keyword.startsAt).getMonth() + 1).padStart(2, '0')
  : (keyword.date || '').split('·')[0] || '04';

export const ArchiveScreen = ({onNav, keywords = [], stats}) => {
  const toast = useToast();
  const [showMore, setShowMore] = useState(false);
  const years = [...new Set(keywords.map(getKeywordYear))].sort((a, b) => b.localeCompare(a));
  const months = [...new Set(keywords.map(getKeywordMonth))].sort((a, b) => b.localeCompare(a));
  const [filterYear, setFilterYear] = useState(years[0] || '2026');
  const [filterMonth, setFilterMonth] = useState(months[0] || '04');
  const [yearOpen, setYearOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    if (years.length && !years.includes(filterYear)) setFilterYear(years[0]);
    if (months.length && !months.includes(filterMonth)) setFilterMonth(months[0]);
  }, [years, months, filterYear, filterMonth]);

  const filteredKeywords = keywords.filter((k) => getKeywordYear(k) === filterYear && getKeywordMonth(k) === filterMonth);
  const keywordDays = stats?.serviceDays || keywords.length;
  const totalWritings = stats?.posts ?? keywords.reduce((sum, k) => sum + (k.count || 0), 0);
  const visibleKeywords = showMore ? filteredKeywords : filteredKeywords.slice(0, 10);
  const topKeywords = [...keywords]
    .filter((k) => k.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const now = new Date();
  const daysInMonth = new Date(Number(filterYear), Number(filterMonth), 0).getDate();
  const keywordByDate = new Map(filteredKeywords.map((k) => [k.startsAt ? formatMonthDay(k.startsAt) : k.date, k]));
  const streakByDay = new Map((streak?.days || []).map((day) => [day.day, day]));
  const grid = Array.from({length: daysInMonth}, (_, i) => {
    const dateKey = `${filterMonth}·${String(i + 1).padStart(2, '0')}`;
    const cellDate = new Date(Number(filterYear), Number(filterMonth) - 1, i + 1);
    const isToday = cellDate.toDateString() === now.toDateString();
    const dayState = streakByDay.get(i + 1);
    const keyword = keywordByDate.get(dateKey) || dayState?.keyword;
    const status = dayState?.status || (isToday ? 'today' : cellDate > now ? 'future' : keyword ? 'missed' : 'none');
    return { status, keyword, written: Boolean(dayState?.written) };
  });

  useEffect(() => {
    const token = readString('wh_auth_token');
    if (!token) {
      setStreak(null);
      return;
    }
    let cancelled = false;
    getMyStreak({ year: filterYear, month: filterMonth, token })
      .then(({ streak: remoteStreak }) => {
        if (!cancelled) setStreak(remoteStreak || null);
      })
      .catch(() => {
        if (!cancelled) setStreak(null);
      });
    return () => {
      cancelled = true;
    };
  }, [filterYear, filterMonth]);

  const handleRead = (k) => {
    toast(`${k.word} · ${k.eng} — 글 목록으로 이동합니다`);
    onNav('feed', { keyword: k });
  };

  const handleTopKw = (word) => {
    toast(`${word} — 글 목록으로 이동합니다`);
    onNav('feed', { keyword: { word } });
  };

  const handleCalendarDay = (day) => {
    if (day.status === 'future') return;
    if (!day.keyword?.word) {
      toast('이 날짜에는 연결된 키워드가 없습니다.');
      return;
    }
    toast(`${day.keyword.word} — 글 목록으로 이동합니다`);
    onNav('feed', { keyword: day.keyword });
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
            <div className="eyebrow" style={{marginBottom:10}}>ARCHIVE · {keywordDays.toLocaleString()} DAYS · {totalWritings.toLocaleString()} WRITINGS</div>
            <h1 className="hero-title-xl" style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:56, letterSpacing:'-0.025em', lineHeight:1, margin:0, color:'var(--ink)'}}>키워드 아카이브</h1>
            <p style={{fontSize:14, color:'var(--ink-mute)', marginTop:14, maxWidth:'48ch', lineHeight:1.65}}>2026년 4월 1일부터 매일 하나씩, {keywordDays.toLocaleString()}개의 키워드가 쌓였습니다. 한 글자, 한 단어, 하나의 감정에 대한 기록.</p>
          </div>
          <div style={{display:'flex', gap:8}} onClick={e => e.stopPropagation()}>
            <DropFilter label="연도" value={filterYear} open={yearOpen}
              onToggle={() => { setYearOpen(v=>!v); setMonthOpen(false); }}
              options={years.length ? years : ['2026']} onSelect={setFilterYear} />
            <DropFilter label="월" value={filterMonth} open={monthOpen}
              onToggle={() => { setMonthOpen(v=>!v); setYearOpen(false); }}
              options={months.length ? months : ['04']} onSelect={setFilterMonth} />
          </div>
        </section>

        <section style={{display:'grid', gridTemplateColumns:'420px 1fr', gap:56, paddingTop:32}}>
          <div>
            <div className="col-h">
              <h2>{filterYear}년 {filterMonth}월</h2>
              <span className="meta">{filteredKeywords.length.toLocaleString()} KEYWORDS</span>
            </div>
            <div className="cal">
              {grid.map((day, i) => (
                <div key={i}
                  className={`d${day.status === 'today' ? ' today' : day.status === 'written' ? ' on' : day.status === 'missed' ? ' missed' : ''}`}
                  title={day.keyword?.word ? `${day.keyword.no || ''} ${day.keyword.word}` : undefined}
                  style={{...(day.status === 'future'?{opacity:0.25}:{}), ...(day.status !== 'future'?{cursor:'pointer'}:{})}}
                  onClick={() => handleCalendarDay(day)}>
                  {day.status === 'today' ? (day.written ? '✓' : '●') : ''}
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:14, marginTop:16, fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-mute)', alignItems:'center'}}>
              {[['var(--accent)','오늘'],['var(--ink)','작성함'],['var(--paper-3)','미작성']].map(([bg,label]) => (
                <span key={label} style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <span style={{width:10, height:10, background:bg, display:'block'}}/>
                  {label}
                </span>
              ))}
            </div>

            <div style={{marginTop:32}}>
              <div className="col-h"><h2>가장 많이 쓴 키워드</h2></div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                {topKeywords.length ? topKeywords.map((item, i) => (
                  <div key={item.id || item.word || i} onClick={() => handleTopKw(item.word)} style={{border:'1px solid var(--rule-ghost)', padding:16, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer'}}>
                    <div>
                      <div className="meta" style={{fontSize:9.5}}>{item.eng || 'KEYWORD'}</div>
                      <div style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:22, letterSpacing:'-0.02em'}}>{item.word}</div>
                    </div>
                    <div style={{fontFamily:'var(--f-latin)', fontWeight:700, fontSize:22, color:'var(--accent)', fontVariantNumeric:'tabular-nums'}}>
                      {item.count.toLocaleString()}<span style={{fontSize:11, color:'var(--ink-mute)', fontWeight:500, marginLeft:2}}>글</span>
                    </div>
                  </div>
                )) : (
                  <div className="meta" style={{fontSize:11}}>아직 작성 데이터가 없습니다.</div>
                )}
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
                <span className="kdate">{k.startsAt ? formatYearMonthDay(k.startsAt) : `${filterYear}·${k.date}`}</span>
                <div>
                  <div className="kword">
                    <span className="kor-serif">{k.word}</span>
                    <span style={{marginLeft:14, color:'var(--ink-faint)', fontFamily:'var(--f-serif)', fontSize:14, letterSpacing:'0.08em'}}>{k.eng}</span>
                  </div>
                  <div className="meta" style={{fontSize:10.5, marginTop:2}}>
                    NO. {k.no || String(Math.max(1, keywordDays - i)).padStart(4,'0')}
                  </div>
                </div>
                <div className="kcount">{k.count.toLocaleString()}<small>글</small></div>
                <div style={{textAlign:'right'}}>
                  <button className="btn sm ghost" onClick={() => handleRead(k)}>읽기 <span className="arr">→</span></button>
                </div>
              </div>
            ))}
            {!showMore && filteredKeywords.length > 10 && (
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
