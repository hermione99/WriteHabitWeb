import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast.jsx';
import { createKeywordSuggestion, getMyStreak } from '../lib/api.js';
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

const getTodayParts = (todayKw) => {
  if (todayKw?.startsAt) {
    const date = new Date(todayKw.startsAt);
    if (!Number.isNaN(date.getTime())) {
      return {
        year: String(date.getFullYear()),
        month: String(date.getMonth() + 1).padStart(2, '0'),
      };
    }
  }
  if (todayKw?.dateStr) {
    const [year, month] = todayKw.dateStr.split('·');
    if (year && month) return { year, month: month.padStart(2, '0') };
  }
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
  };
};

export const ArchiveScreen = ({onNav, keywords = [], stats, todayKw}) => {
  const toast = useToast();
  const [showMore, setShowMore] = useState(false);
  const todayParts = getTodayParts(todayKw);
  const todayArchiveKeyword = todayKw?.word
    ? {
        ...todayKw,
        id: todayKw.id,
        word: todayKw.word,
        eng: todayKw.eng,
        count: stats?.todayPosts ?? 0,
        startsAt: todayKw.startsAt,
        date: `${todayParts.month}·${todayKw.dateStr?.split('·')?.[2] || String(new Date().getDate()).padStart(2, '0')}`,
      }
    : null;
  const archiveKeywords = [...(todayArchiveKeyword ? [todayArchiveKeyword] : []), ...keywords]
    .reduce((map, keyword) => {
      const key = keyword.id || `${getKeywordYear(keyword)}-${getKeywordMonth(keyword)}-${keyword.word}`;
      if (!key || map.has(key)) return map;
      map.set(key, keyword);
      return map;
    }, new Map());
  const allKeywords = [...archiveKeywords.values()];
  const years = [...new Set(allKeywords.map(getKeywordYear))].sort((a, b) => b.localeCompare(a));
  const [filterYear, setFilterYear] = useState(todayParts.year);
  const months = [...new Set(allKeywords.filter((keyword) => getKeywordYear(keyword) === filterYear).map(getKeywordMonth))]
    .sort((a, b) => b.localeCompare(a));
  const [filterMonth, setFilterMonth] = useState(todayParts.month);
  const [yearOpen, setYearOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [streak, setStreak] = useState(null);
  const [suggestWord, setSuggestWord] = useState('');
  const [suggestEng, setSuggestEng] = useState('');
  const [suggestNote, setSuggestNote] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (years.length && !years.includes(filterYear)) {
      setFilterYear(years.includes(todayParts.year) ? todayParts.year : years[0]);
    }
  }, [years, filterYear, todayParts.year]);

  useEffect(() => {
    if (!months.length) return;
    if (!months.includes(filterMonth)) {
      setFilterMonth(filterYear === todayParts.year && months.includes(todayParts.month) ? todayParts.month : months[0]);
    }
  }, [months, filterMonth, filterYear, todayParts.year, todayParts.month]);

  const filteredKeywords = allKeywords.filter((k) => getKeywordYear(k) === filterYear && getKeywordMonth(k) === filterMonth);
  const keywordDays = stats?.serviceDays || allKeywords.length;
  const totalWritings = stats?.posts ?? allKeywords.reduce((sum, k) => sum + (k.count || 0), 0);
  const visibleKeywords = showMore ? filteredKeywords : filteredKeywords.slice(0, 10);
  const todayKeywordForRank = todayKw?.word
    ? {
        ...todayKw,
        id: todayKw.id,
        word: todayKw.word,
        eng: todayKw.eng,
        count: stats?.todayPosts ?? 0,
        startsAt: todayKw.startsAt,
      }
    : null;
  const topKeywordCandidates = [...allKeywords, ...(todayKeywordForRank ? [todayKeywordForRank] : [])]
    .reduce((map, keyword) => {
      const key = keyword.id || keyword.word;
      if (!key) return map;
      const existing = map.get(key);
      map.set(key, {
        ...keyword,
        count: Math.max(existing?.count || 0, keyword.count || 0),
      });
      return map;
    }, new Map());
  const topKeywords = [...topKeywordCandidates.values()]
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

  const handleTopKw = (keyword) => {
    toast(`${keyword.word} — 글 목록으로 이동합니다`);
    onNav('feed', { keyword });
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

  const handleSuggestKeyword = async (event) => {
    event.preventDefault();
    const token = readString('wh_auth_token');
    if (!token) {
      toast('키워드를 제안하려면 로그인이 필요합니다.');
      onNav('login');
      return;
    }
    if (!suggestWord.trim()) {
      toast('제안할 키워드를 입력해주세요.');
      return;
    }
    setSuggesting(true);
    try {
      await createKeywordSuggestion({
        word: suggestWord.trim(),
        eng: suggestEng.trim(),
        note: suggestNote.trim(),
        token,
      });
      setSuggestWord('');
      setSuggestEng('');
      setSuggestNote('');
      toast('키워드 제안을 보냈습니다. 운영팀이 검토할게요.');
    } catch (error) {
      toast(error.message || '키워드 제안에 실패했습니다.', 'error');
    } finally {
      setSuggesting(false);
    }
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
                  <div key={item.id || item.word || i} onClick={() => handleTopKw(item)} style={{border:'1px solid var(--rule-ghost)', padding:16, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer'}}>
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

            <form onSubmit={handleSuggestKeyword} style={{marginTop:32, borderTop:'1px solid var(--rule-soft)', paddingTop:24}}>
              <div className="col-h">
                <h2>키워드 제안</h2>
                <span className="meta">SUGGEST A WORD</span>
              </div>
              <p style={{fontSize:13, color:'var(--ink-mute)', lineHeight:1.65, margin:'0 0 14px'}}>
                다음에 함께 쓰고 싶은 단어를 보내주세요. 운영팀이 검토해 오늘의 키워드 후보로 등록합니다.
              </p>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
                <div>
                  <div className="label" style={{fontSize:10, marginBottom:4}}>한글 키워드</div>
                  <input className="field" value={suggestWord} onChange={e=>setSuggestWord(e.target.value)}
                    maxLength={40} placeholder="예) 약속" />
                </div>
                <div>
                  <div className="label" style={{fontSize:10, marginBottom:4}}>영문 표기 (선택)</div>
                  <input className="field" value={suggestEng} onChange={e=>setSuggestEng(e.target.value)}
                    maxLength={80} placeholder="PROMISE" />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div className="label" style={{fontSize:10, marginBottom:4}}>제안 이유 (선택)</div>
                <textarea className="field" value={suggestNote} onChange={e=>setSuggestNote(e.target.value)}
                  maxLength={300} placeholder="이 단어로 어떤 글을 쓰고 싶은지 짧게 알려주세요."
                  style={{minHeight:72, resize:'none', border:'none', borderBottom:'1px solid var(--rule-soft)', outline:'none', background:'transparent', fontFamily:'var(--f-kr)', fontSize:14, color:'var(--ink)', width:'100%'}} />
              </div>
              <button className="btn solid" type="submit" disabled={suggesting}
                style={{width:'100%', justifyContent:'center', opacity:suggesting ? 0.7 : 1}}>
                {suggesting ? '전송 중…' : '키워드 제안하기'} <span className="arr">→</span>
              </button>
            </form>
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
