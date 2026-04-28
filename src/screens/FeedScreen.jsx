import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar.jsx';
import { IconBookmark, IconComment, IconHeart } from '../components/Icons.jsx';
import { ReportModal } from '../components/ReportModal.jsx';
import { useToast } from '../components/Toast.jsx';

const EXTRA_POSTS = [
  { id:7, title:'봄비와 함께 온 기억', body:'봄비가 내리던 날, 우리는 처음 만났다. 그 비가 이별의 전조였는지, 아니면 시작의 신호였는지 아직도 모르겠다. 다만 비 냄새가 나면 그 골목이 생각난다.', author:'윤서하', handle:'seoha', initial:'윤', time:'6시간 전', read:'2분', likes:29, comments:4, bookmarks:8, bookmarked:false },
  { id:8, title:'다시 읽는 오래된 메시지', body:'지운 줄 알았는데 남아 있었다. 3년 전 너의 문장들. 맞춤법도 틀리고, 이모티콘도 어색한데 그때는 그게 전부였다. 화면을 오래 보다가 그냥 껐다.', author:'강태준', handle:'taejun', initial:'강', time:'7시간 전', read:'3분', likes:47, comments:11, bookmarks:19, bookmarked:false },
  { id:9, title:'마지막으로 같이 먹은 밥', body:'헤어지기로 한 날, 우리는 이상하게도 밥을 먹었다. 둘 다 많이 먹었다. 배가 고파서가 아니라 그 시간을 조금 더 붙잡고 싶어서였을 것이다.', author:'오지민', handle:'jimin_o', initial:'오', time:'8시간 전', read:'2분', likes:63, comments:8, bookmarks:22, bookmarked:false },
];

export const FeedScreen = ({onNav, posts, onToggleLike, onToggleBookmark, blocks, follows, onToggleFollow, onReport, onBlockAuthor, todayKw, keywordFilter, onClearKeywordFilter, onSearch}) => {
  const toast = useToast();
  const [filter, setFilter] = useState('최신');
  const [showExtra, setShowExtra] = useState(false);
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const filters = ['최신','인기','팔로잉','짧은 글','긴 글'];
  const blockedCount = blocks?.size || 0;
  const lastSentQuery = useRef('');
  useEffect(() => {
    if (!onSearch) return;
    const trimmed = query.trim();
    const handle = setTimeout(() => {
      if (lastSentQuery.current === trimmed) return;
      lastSentQuery.current = trimmed;
      onSearch(trimmed);
    }, 350);
    return () => clearTimeout(handle);
  }, [query, onSearch]);

  const handleFilter = (f) => {
    if (f === '팔로잉' && (!follows || follows.size === 0)) {
      toast('아직 팔로우한 작가가 없습니다. 글을 읽고 작가를 팔로우해보세요!');
      return;
    }
    setFilter(f);
  };

  const allPosts = showExtra && !keywordFilter ? [...posts, ...EXTRA_POSTS] : posts;
  const sorted = filter === '인기'
    ? [...allPosts].sort((a,b) => b.likes - a.likes)
    : filter === '짧은 글'
    ? [...allPosts].sort((a,b) => parseInt(a.read) - parseInt(b.read))
    : filter === '긴 글'
    ? [...allPosts].sort((a,b) => parseInt(b.read) - parseInt(a.read))
    : filter === '팔로잉'
    ? allPosts.filter(p => follows?.has(p.handle))
    : allPosts;

  const q = query.trim().toLowerCase();
  const visible = q
    ? sorted.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        (p.handle || '').toLowerCase().includes(q)
      )
    : sorted;

  return (
    <div onClick={() => openMenuId !== null && setOpenMenuId(null)}>
      <ReportModal
        open={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={({reason, detail}) => onReport({
          targetType: reportTarget.type, targetId: reportTarget.id,
          targetHandle: reportTarget.handle, reason, detail,
        })}
      />
      <div className="wrap">
        {blockedCount > 0 && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
            padding:'8px 14px', marginTop:14,
            border:'1px solid var(--rule-soft)', background:'var(--paper-2)',
            fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-mute)',
          }}>
            <span>차단된 작가 {blockedCount}명의 글을 숨기고 있습니다.</span>
            <button className="btn sm ghost" style={{padding:'3px 8px', fontSize:10.5}}
              onClick={() => onNav('profile')}>차단 관리 →</button>
          </div>
        )}
        {/* Hero */}
        <section className="kw-hero">
          <div>
            <div className="kw-eyebrow">
              <span className="dash"></span>
              <span>오늘의 키워드 · Daily Keyword · No. {todayKw.no}</span>
            </div>
            <h1 className="kw-title">
              <span className="kor-serif">{todayKw.word}</span>
              <span style={{color:'var(--ink-faint)', fontWeight:300, fontSize:54, marginLeft:18}}>{todayKw.eng.charAt(0) + todayKw.eng.slice(1).toLowerCase()}</span>
            </h1>
            <p className="kw-sub">{todayKw.sub}</p>
          </div>
          <div className="kw-side">
            <span className="label" style={{marginBottom:4}}>오늘 작성된 글</span>
            <span className="big">{posts.filter(p => p.keywordId === todayKw.id || p.keyword?.id === todayKw.id).length.toLocaleString()}</span>
            <span className="meta">마감까지 · 14H 32M</span>
            <button className="btn accent sm" style={{marginTop:10, alignSelf:'flex-end'}} onClick={() => onNav('write')}>
              오늘의 글 쓰기 <span className="arr">→</span>
            </button>
            <button className="btn sm ghost" style={{marginTop:8, alignSelf:'flex-end'}} onClick={() => onNav('feed', { keyword: todayKw })}>
              오늘 키워드 글 보기
            </button>
          </div>
        </section>

        {keywordFilter && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:16,
            padding:'12px 16px', marginTop:18,
            border:'1px solid var(--accent)', background:'var(--accent-soft)',
          }}>
            <div>
              <div className="label" style={{fontSize:10, marginBottom:4}}>KEYWORD FILTER</div>
              <div style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:22, color:'var(--ink)'}}>
                {keywordFilter.word}
                {keywordFilter.eng && <span style={{fontFamily:'var(--f-serif)', fontSize:12, color:'var(--ink-faint)', marginLeft:10, letterSpacing:'0.08em'}}>{keywordFilter.eng}</span>}
              </div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <span className="meta">{visible.length}편</span>
              <button className="btn sm ghost" onClick={onClearKeywordFilter}>전체 글 보기</button>
            </div>
          </div>
        )}

        {/* Filter + search */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, padding:'20px 0 8px'}}>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {filters.map(f => (
              <button key={f} className={`chip${filter===f?' active':''}`} onClick={() => handleFilter(f)}>{f}</button>
            ))}
          </div>
          <div style={{display:'flex', gap:14, alignItems:'center'}}>
            <div style={{position:'relative'}}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="제목 · 본문 · 작가 검색"
                style={{
                  width:240, padding:'7px 28px 7px 12px',
                  border:'1px solid var(--rule-soft)', background:'var(--paper)',
                  fontFamily:'var(--f-kr)', fontSize:12, color:'var(--ink)',
                  outline:'none',
                }}
                onFocus={e => e.target.style.borderColor='var(--ink-mute)'}
                onBlur={e => e.target.style.borderColor='var(--rule-soft)'}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{
                  position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', color:'var(--ink-faint)', cursor:'pointer',
                  fontSize:14, padding:0, lineHeight:1,
                }} title="지우기">×</button>
              )}
            </div>
            <div className="meta" style={{fontSize:11, whiteSpace:'nowrap'}}>
              {q ? `검색 · ${visible.length}편` : `정렬 · ${{'최신':'최신순','인기':'인기순','짧은 글':'짧은 글 순','긴 글':'긴 글 순','팔로잉':'최신순'}[filter]}`}
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="feed">
          {visible.length === 0 && (
            <div style={{padding:'72px 0', textAlign:'center', color:'var(--ink-mute)'}}>
              {q ? (
                <>
                  <div style={{fontFamily:'var(--f-kr-serif)', fontSize:22, fontWeight:700, color:'var(--ink)', marginBottom:8}}>검색 결과 없음</div>
                  <div style={{fontFamily:'var(--f-mono)', fontSize:11.5}}>"{query}" — 일치하는 글을 찾을 수 없습니다.</div>
                  <button className="btn sm ghost" style={{marginTop:18}} onClick={() => setQuery('')}>검색 지우기</button>
                </>
              ) : filter === '팔로잉' ? (
                <>
                  <div style={{fontFamily:'var(--f-kr-serif)', fontSize:22, fontWeight:700, color:'var(--ink)', marginBottom:8}}>팔로우한 작가의 새 글이 없습니다</div>
                  <div style={{fontFamily:'var(--f-mono)', fontSize:11.5}}>아직 올라온 글이 없어요. 다른 작가도 둘러보세요.</div>
                  <button className="btn sm ghost" style={{marginTop:18}} onClick={() => setFilter('최신')}>전체 보기</button>
                </>
              ) : (
                <div style={{fontFamily:'var(--f-mono)', fontSize:11.5}}>표시할 글이 없습니다.</div>
              )}
            </div>
          )}
          {visible.map((p, i) => (
            <article className="entry" key={p.id} onClick={() => onNav('detail', p)}>
              <div className="en">
                {String(i+1).padStart(2,'0')} <span style={{opacity:0.5}}>/ {visible.length}</span>
              </div>
              <div>
                <h3><span className="kor-serif">{p.title}</span></h3>
                <p>{p.body}</p>
                <div className="byline">
                  <Avatar url={p.avatarUrl} initial={p.initial} size={26} fontSize={11}
                    style={{cursor:'pointer'}}
                    onClick={e => { e.stopPropagation(); onNav('profile', p); }} />
                  <span className="author" style={{cursor:'pointer'}} onClick={e => { e.stopPropagation(); onNav('profile', p); }}>{p.author}</span>
                  <span className="sep">·</span>
                  <span>@{p.handle}</span>
                  <span className="sep">·</span>
                  <span>{p.time}</span>
                  <span className="sep">·</span>
                  <span>읽기 {p.read}</span>
                  {p.keyword?.word && (
                    <>
                      <span className="sep">·</span>
                      <button onClick={e => { e.stopPropagation(); onNav('feed', { keyword: p.keyword }); }}
                        style={{background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--accent)', fontFamily:'var(--f-mono)', fontSize:11}}>
                        #{p.keyword.word}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="stats" onClick={e => e.stopPropagation()} style={{position:'relative'}}>
                <span className="row" onClick={() => onToggleLike(p.id)} style={{color: p.liked ? 'var(--accent)' : undefined}}>
                  <IconHeart filled={p.liked} />
                  <span className={p.liked ? 'n on' : 'n'}>{p.likes}</span>
                </span>
                <span className="row" onClick={() => onNav('detail', p)}>
                  <IconComment /><span className="n">{p.comments}</span>
                </span>
                <span className="row" onClick={() => onToggleBookmark(p.id)} style={{color: p.bookmarked ? 'var(--accent)' : undefined}}>
                  <IconBookmark filled={p.bookmarked} /><span className={p.bookmarked ? 'n on' : 'n'}>{p.bookmarks}</span>
                </span>
                <span className="row" style={{cursor:'pointer'}} title="더보기"
                  onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id); }}>
                  <span style={{fontSize:13, lineHeight:1, color:'var(--ink-mute)'}}>⋯</span>
                </span>
                {openMenuId === p.id && (
                  <div style={{position:'absolute', right:0, top:'calc(100% + 6px)', zIndex:30,
                    background:'var(--card)', border:'1px solid var(--rule-soft)', borderRadius:4,
                    boxShadow:'0 8px 24px rgba(0,0,0,0.08)', minWidth:170,
                  }}>
                    <button onClick={() => { setOpenMenuId(null); setReportTarget({type:'post', id:p.id, handle:p.handle, label:`${p.author}님의 "${p.title}"`}); }}
                      style={{display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', fontFamily:'var(--f-kr)', fontSize:13, color:'var(--ink-soft)', cursor:'pointer'}}>이 글 신고</button>
                    <button onClick={() => { setOpenMenuId(null); if (window.confirm(`${p.author}님을 차단하시겠어요?`)) onBlockAuthor(p.handle); }}
                      style={{display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', fontFamily:'var(--f-kr)', fontSize:13, color:'var(--accent)', cursor:'pointer', borderTop:'1px solid var(--rule-ghost)'}}>@{p.handle} 차단</button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {visible.length > 0 && (
            <div style={{textAlign:'center', padding:'32px 0 16px'}}>
              {!q && !showExtra && !keywordFilter
                ? <button className="btn ghost" onClick={() => setShowExtra(true)}>더 많은 글 보기 <span className="arr">↓</span></button>
                : <span className="meta">{q ? `검색 결과 · ${visible.length}편` : `모든 글을 불러왔습니다 · ${visible.length}편`}</span>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
