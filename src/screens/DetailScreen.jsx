import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar.jsx';
import { IconBookmark, IconComment, IconHeart } from '../components/Icons.jsx';
import { ReportModal } from '../components/ReportModal.jsx';
import { useToast } from '../components/Toast.jsx';
import { createComment, deleteComment, listComments } from '../lib/api.js';
import { readJSON, readString } from '../lib/storage.js';

const DEFAULT_COMMENTS = [
  {id:1, n:'정윤', i:'정', t:'2분 전', body:'마지막 문단에서 울컥했어요. "이별을 견딘 나 자신" 이 문장이 오래 남을 것 같습니다.', cl:12, liked:false, replyOpen:false, replyText:''},
  {id:2, n:'김도현', i:'김', t:'18분 전', body:'서른의 이별에 대한 묘사가 너무 구체적이고 솔직해서 좋았습니다. 덕분에 제 경험이 다시 떠올랐어요.', cl:5, liked:false, replyOpen:false, replyText:''},
  {id:3, n:'박서연', i:'박', t:'1시간 전', body:'조용히 찾아와서 조용히 떠난다는 표현, 문장이 너무 정확해서 한참 멈춰 있었습니다.', cl:2, liked:false, replyOpen:false, replyText:''},
];

export const DetailScreen = ({post, onNav, posts, onToggleLike, onToggleBookmark, user, onEditPost, onDeletePost, blocks, follows, onToggleFollow, onReport, onBlockAuthor, todayKw}) => {
  const toast = useToast();
  const p = post || posts[0];
  const postIndex = posts.findIndex(x => x.id === p.id);
  const currentKeyword = p?.keyword || todayKw;
  const isMine = user && (p?.handle === user.handle || p?.author === user.nickname);
  const isBlocked = blocks?.has(p.handle);

  const [reportTarget, setReportTarget] = useState(null); // {type, id, handle, label}
  const [moreOpen, setMoreOpen] = useState(false);

  const handleEdit = () => onEditPost(p);
  const handleDelete = () => {
    if (!window.confirm('이 글을 삭제할까요? 댓글도 함께 사라지고 되돌릴 수 없습니다.')) return;
    onDeletePost(p.id);
    toast('글이 삭제되었습니다.');
    onNav('feed');
  };

  const openReportPost = () => {
    setMoreOpen(false);
    setReportTarget({ type:'post', id:p.id, handle:p.handle, label:`${p.author}님의 "${p.title}"` });
  };
  const handleBlockAuthor = () => {
    setMoreOpen(false);
    if (!isBlocked && !window.confirm(`${p.author}님을 차단하시겠어요? 이 작가의 글과 댓글이 모두 숨겨집니다.`)) return;
    onBlockAuthor(p.handle);
    if (!isBlocked) onNav('feed');
  };
  const openReportComment = (c) => {
    setReportTarget({ type:'comment', id:c.id, handle:p.handle, label:`${c.n}님의 댓글` });
  };

  const [liked,     setLiked]     = useState(p.liked      || false);
  const [bookmarked,setBookmarked]= useState(p.bookmarked  || false);
  const followed = follows?.has(p.handle) || false;
  const [likeCount, setLikeCount] = useState(p.likes);
  const [bmCount,   setBmCount]   = useState(p.bookmarks);

  const [commentText, setCommentText] = useState('');
  const [commentsSource, setCommentsSource] = useState('local');
  const [comments, setComments] = useState(() => {
    const all = readJSON('wh_comments', {});
    return all[p.id] || DEFAULT_COMMENTS;
  });

  useEffect(() => {
    const token = readString('wh_auth_token');
    listComments({ postId: p.id, token })
      .then(({ comments: remoteComments }) => {
        setComments(remoteComments || []);
        setCommentsSource('server');
      })
      .catch(() => {
        const all = readJSON('wh_comments', {});
        setComments(all[p.id] || DEFAULT_COMMENTS);
        setCommentsSource('local');
      });
  }, [p.id]);

  /* Persist comments per-post */
  useEffect(() => {
    if (commentsSource !== 'local') return;
    try {
      const all = readJSON('wh_comments', {});
      all[p.id] = comments;
      localStorage.setItem('wh_comments', JSON.stringify(all));
    } catch {}
  }, [comments, p.id, commentsSource]);

  const commentRef = useRef(null);

  const handleLike = async () => {
    const nextLiked = !liked;
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    try {
      await onToggleLike(p.id);
    } catch {
      setLiked(!nextLiked);
      setLikeCount(c => nextLiked ? c - 1 : c + 1);
    }
  };

  const handleBookmark = async () => {
    const nextBookmarked = !bookmarked;
    setBookmarked(b => !b);
    setBmCount(c => bookmarked ? c - 1 : c + 1);
    try {
      await onToggleBookmark(p.id);
    } catch {
      setBookmarked(!nextBookmarked);
      setBmCount(c => nextBookmarked ? c - 1 : c + 1);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const body = commentText.trim();
    const token = readString('wh_auth_token');

    if (token && typeof p.id === 'string') {
      try {
        const { comment } = await createComment({ postId: p.id, body, token });
        setComments(c => [comment, ...c]);
        setCommentsSource('server');
        setCommentText('');
        return;
      } catch (error) {
        if (error.status !== 503) {
          toast(error.message || '댓글 등록에 실패했습니다.', 'error');
          return;
        }
      }
    }

    setComments(c => [{id: Date.now(), n:user?.nickname || '김민지', i:user?.nickname?.[0] || '민', t:'방금', body, cl:0, liked:false, replyOpen:false, replyText:''}, ...c]);
    setCommentsSource('local');
    setCommentText('');
  };

  const handleDeleteComment = async (comment) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    const token = readString('wh_auth_token');

    if (token && typeof p.id === 'string' && typeof comment.id === 'string') {
      try {
        await deleteComment({ postId: p.id, commentId: comment.id, token });
        setComments(cs => cs.filter(c => c.id !== comment.id));
        return;
      } catch (error) {
        if (error.status !== 503) {
          toast(error.message || '댓글 삭제에 실패했습니다.', 'error');
          return;
        }
      }
    }

    setComments(cs => cs.filter(c => c.id !== comment.id));
    setCommentsSource('local');
  };

  const toggleCommentLike = (id) => {
    setComments(cs => cs.map(c => c.id === id
      ? {...c, liked: !c.liked, cl: c.liked ? c.cl - 1 : c.cl + 1}
      : c
    ));
  };

  const toggleReply = (id) => {
    setComments(cs => cs.map(c => c.id === id ? {...c, replyOpen: !c.replyOpen} : c));
  };

  const submitReply = (id) => {
    setComments(cs => cs.map(c => {
      if (c.id !== id || !c.replyText?.trim()) return c;
      return {...c, replyOpen: false, replyText: '', replies: [...(c.replies||[]), {n:'김민지', i:'민', t:'방금', body:c.replyText}]};
    }));
  };

  const related = posts.filter(x => x.id !== p.id).slice(0, 3);

  return (
    <div onClick={() => moreOpen && setMoreOpen(false)}>
      <ReportModal
        open={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={({reason, detail}) => onReport({
          targetType: reportTarget.type, targetId: reportTarget.id,
          targetHandle: reportTarget.handle, reason, detail,
        })}
      />
      <div className="wrap" style={{display:'grid', gridTemplateColumns:'1fr 280px', gap:56, paddingTop:36}}>
        <article>
          {/* Breadcrumb */}
          <div className="meta" style={{marginBottom:24, display:'flex', gap:8}}>
            <span style={{cursor:'pointer'}} onClick={() => onNav('archive')}>ARCHIVE</span>
            <span style={{opacity:0.4}}>/</span>
            <span>KW {todayKw.no} · {currentKeyword?.word || todayKw.word} · {currentKeyword?.eng || todayKw.eng}</span>
            <span style={{opacity:0.4}}>/</span>
            <span style={{color:'var(--ink)'}}>POST · {String(postIndex + 1).padStart(4,'0')}</span>
          </div>

          {/* Title */}
          <h1 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:48, lineHeight:1.2, letterSpacing:'-0.025em', margin:'0 0 20px', color:'var(--ink)'}}>
            {p.title}
          </h1>

          {/* Byline */}
          <div style={{display:'flex', alignItems:'center', gap:14, paddingBottom:28, borderBottom:'1px solid var(--rule)', marginBottom:36}}>
            <Avatar url={p.avatarUrl} initial={p.initial} size={36} style={{cursor:'pointer'}}
              onClick={() => onNav('profile', p)} />
            <div style={{flex:1}}>
              <div style={{fontFamily:'var(--f-kr)', fontWeight:600, fontSize:14}}>
                {p.author} <span style={{color:'var(--ink-mute)', fontWeight:400, marginLeft:6}}>@{p.handle}</span>
              </div>
              <div className="meta" style={{fontSize:11, marginTop:2}}>
                2026·04·23 · 14:32 · 읽기 {p.read}
                {p.edited && <span style={{marginLeft:6, color:'var(--ink-faint)'}}>· 수정됨</span>}
              </div>
            </div>
            {isMine ? (
              <div style={{display:'flex', gap:6}}>
                <button className="btn sm" onClick={handleEdit}>수정</button>
                <button className="btn sm ghost" style={{color:'var(--accent)', borderColor:'var(--accent)'}} onClick={handleDelete}>삭제</button>
              </div>
            ) : (
              <div style={{display:'flex', gap:6, alignItems:'center', position:'relative'}}>
                <button className={`btn sm${followed ? ' solid' : ''}`} onClick={() => onToggleFollow(p.handle)}>
                  {followed ? '팔로잉 ✓' : '＋ 팔로우'}
                </button>
                <button className="btn sm ghost" style={{padding:'5px 10px', fontSize:14, lineHeight:1}}
                  onClick={() => setMoreOpen(o => !o)} title="더보기">⋯</button>
                {moreOpen && (
                  <div style={{position:'absolute', right:0, top:'calc(100% + 6px)', zIndex:30,
                    background:'var(--card)', border:'1px solid var(--rule-soft)', borderRadius:4,
                    boxShadow:'0 8px 24px rgba(0,0,0,0.08)', minWidth:170,
                  }} onClick={e => e.stopPropagation()}>
                    <button onClick={openReportPost} style={{display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', fontFamily:'var(--f-kr)', fontSize:13, color:'var(--ink-soft)', cursor:'pointer'}}>이 글 신고</button>
                    <button onClick={handleBlockAuthor} style={{display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', fontFamily:'var(--f-kr)', fontSize:13, color:'var(--accent)', cursor:'pointer', borderTop:'1px solid var(--rule-ghost)'}}>
                      {isBlocked ? '차단 해제' : `@${p.handle} 차단`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="article-body">
            <p>{p.body}</p>
            <p>그는 마지막 인사조차 하지 않았다. 어떤 이별은 말없이 완성된다. 대답 없는 질문들만 남기고. 우리는 헤어졌다는 문장 하나로 설명될 수 없는 것들. 그 사이에 놓인 무수한 오후와, 함께 듣던 노래와, 두 번 다시 웃지 않을 농담 같은 것들.</p>
            <blockquote>이별은 사람이 떠나는 일이 아니라, 그 사람과 살던 내가 한 명 더 죽는 일이다.</blockquote>
            <p>서른은 이별의 나이다. 청춘의 마지막 정거장에서 많은 것들이 한꺼번에 내린다. 친구들의 연락이 뜸해지고, 한때 소중했던 취향들이 낯설어진다. 부모의 전화에 처음으로 불안을 느끼고, 내가 누구였는지를 자주 잊는다.</p>
            <p>그래도 아침은 온다. 커피를 내리고, 창문을 열고, 오늘도 한 줄을 쓴다. 이별 다음에 오는 것은 새로운 만남이 아니라, 이별을 견딘 나 자신이라는 걸 이제 안다.</p>
          </div>

          {/* Actions */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:44, padding:'16px 0', borderTop:'1px solid var(--rule)', borderBottom:'1px solid var(--rule)'}}>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              <button className={`btn sm${liked?' accent':''}`} onClick={handleLike}>
                <IconHeart filled={liked} size={13}/> 좋아요 <span style={{opacity:0.7}}>{likeCount}</span>
              </button>
              <button className="btn sm" onClick={() => commentRef.current?.scrollIntoView({behavior:'smooth', block:'center'})}>
                <IconComment size={13}/> 댓글 <span style={{opacity:0.7}}>{comments.length}</span>
              </button>
              <button className={`btn sm${bookmarked?' accent':''}`} onClick={handleBookmark}>
                <IconBookmark filled={bookmarked} size={13}/> 저장 <span style={{opacity:0.7}}>{bmCount}</span>
              </button>
            </div>
            <span className="meta">POST · {String(postIndex+1).padStart(4,'0')} / {posts.length}</span>
          </div>

          {/* Comments */}
          <div style={{marginTop:44}} ref={commentRef}>
            <div className="col-h">
              <h2>댓글 <span style={{fontFamily:'var(--f-latin)', color:'var(--ink-mute)', fontSize:14, marginLeft:6}}>{comments.length}</span></h2>
              <span className="meta">최신순 ▾</span>
            </div>

            {/* Comment form */}
            <div style={{display:'grid', gridTemplateColumns:'36px 1fr', gap:14, marginBottom:20}}>
              <Avatar url={user?.avatarUrl} initial={user?.nickname?.[0] || '민'} size={36} />
              <div>
                <textarea
                  className="field"
                  placeholder="이 글에 대한 생각을 남겨주세요"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  style={{minHeight:60, resize:'none', padding:'10px 0', background:'transparent', outline:'none', fontFamily:'var(--f-kr)', fontSize:14, color:'var(--ink)', letterSpacing:'-0.005em', width:'100%', border:'none', borderBottom:'1px solid var(--rule-soft)'}}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleComment(); } }}
                />
                <div style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
                  <span className="meta">⌘/Ctrl + Enter로 등록</span>
                  <button className="btn sm solid" onClick={handleComment}>댓글 남기기</button>
                </div>
              </div>
            </div>

            {comments.filter(c => !blocks?.has(p.handle)).map((c) => (
              <div key={c.id}>
                <div className="comment">
                  <Avatar url={c.avatarUrl} initial={c.i} size={36} />
                  <div>
                    <div className="c-head">
                      <span className="c-author">{c.n}</span>
                      <span className="c-time">{c.t}</span>
                    </div>
                    <div className="c-body">{c.body}</div>
                    <div className="c-actions">
                      <span onClick={() => toggleCommentLike(c.id)}
                        style={{color: c.liked ? 'var(--accent)' : undefined}}>
                        ♥ 좋아요 {c.cl}
                      </span>
                      <span onClick={() => toggleReply(c.id)}>
                        {c.replyOpen ? '취소' : '답글'}
                      </span>
                      {(!user || c.n !== user.nickname) && (
                        <span onClick={() => openReportComment(c)} style={{color:'var(--ink-faint)'}}>신고</span>
                      )}
                      {user && (c.n === user.nickname || c.authorId === user.id || user.role === 'ADMIN') && (
                        <span onClick={() => handleDeleteComment(c)} style={{color:'var(--accent)'}}>삭제</span>
                      )}
                    </div>
                    {/* Inline reply form */}
                    {c.replyOpen && (
                      <div style={{marginTop:10, display:'grid', gridTemplateColumns:'28px 1fr', gap:10}}>
                        <Avatar url={user?.avatarUrl} initial={user?.nickname?.[0] || '민'} size={28} fontSize={11} />
                        <div>
                          <textarea
                            placeholder={`${c.n}님에게 답글...`}
                            value={c.replyText}
                            onChange={e => setComments(cs => cs.map(x => x.id===c.id ? {...x, replyText:e.target.value} : x))}
                            style={{width:'100%', minHeight:48, resize:'none', background:'transparent', border:'none', borderBottom:'1px solid var(--rule-soft)', outline:'none', fontFamily:'var(--f-kr)', fontSize:13, color:'var(--ink)', padding:'6px 0'}}
                            onKeyDown={e => { if(e.key==='Enter' && e.ctrlKey) submitReply(c.id); }}
                          />
                          <div style={{display:'flex', justifyContent:'flex-end', marginTop:6}}>
                            <button className="btn sm solid" onClick={() => submitReply(c.id)}>답글 등록</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Replies */}
                    {c.replies?.map((r, ri) => (
                      <div key={ri} style={{marginTop:10, display:'grid', gridTemplateColumns:'28px 1fr', gap:10, paddingLeft:4, borderLeft:'2px solid var(--rule-ghost)'}}>
                        <Avatar url={r.avatarUrl} initial={r.i || '민'} size={28} fontSize={11} />
                        <div>
                          <div className="c-head"><span className="c-author">{r.n}</span><span className="c-time">{r.t}</span></div>
                          <div className="c-body" style={{fontSize:13}}>{r.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Sidebar */}
        <aside style={{position:'sticky', top:80, alignSelf:'start', display:'flex', flexDirection:'column', gap:20}}>
          <div className="panel">
            <h4>오늘의 키워드</h4>
            <div style={{fontFamily:'var(--f-kw)', fontWeight:700, fontSize:32, letterSpacing:'-0.02em', lineHeight:1, color:'var(--ink)'}}>{todayKw.word}</div>
            <div className="meta" style={{fontSize:10.5, marginTop:6}}>{todayKw.eng} · NO. {todayKw.no}</div>
            <div className="rule-s" style={{margin:'14px 0'}}/>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--ink-soft)'}}>
              <span>오늘 작성</span><span style={{fontWeight:600, fontVariantNumeric:'tabular-nums'}}>1,247</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--ink-soft)', marginTop:6}}>
              <span>현재 읽는 중</span><span style={{fontWeight:600}}>84</span>
            </div>
            <button className="btn sm accent" style={{width:'100%', justifyContent:'center', marginTop:16}} onClick={() => onNav('write')}>
              나도 쓰기 <span className="arr">→</span>
            </button>
          </div>

          <div className="panel">
            <h4>작가 소개</h4>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
              <Avatar url={p.avatarUrl} initial={p.initial} size={44} fontSize={17}
                style={{cursor:'pointer'}} onClick={() => onNav('profile', p)} />
              <div>
                <div style={{fontWeight:600, fontSize:14}}>{p.author}</div>
                <div className="meta" style={{fontSize:10.5}}>@{p.handle}</div>
              </div>
            </div>
            <p style={{fontSize:12.5, color:'var(--ink-mute)', lineHeight:1.6, margin:'12px 0'}}>
              서울에서 글을 씁니다. 조용한 감정과 사소한 장면을 기록하는 일을 좋아합니다.
            </p>
            <div style={{display:'flex', gap:16, fontFamily:'var(--f-mono)', fontSize:11, color:'var(--ink-mute)'}}>
              <span><span style={{color:'var(--ink)'}}>184</span> 글</span>
              <span><span style={{color:'var(--ink)'}}>2.3k</span> 팔로워</span>
            </div>
            {isMine ? (
              <div style={{display:'flex', gap:6, marginTop:14}}>
                <button className="btn sm" style={{flex:1, justifyContent:'center'}} onClick={handleEdit}>수정</button>
                <button className="btn sm ghost" style={{flex:1, justifyContent:'center', color:'var(--accent)', borderColor:'var(--accent)'}} onClick={handleDelete}>삭제</button>
              </div>
            ) : (
              <button className={`btn sm${followed?' solid':''}`} style={{width:'100%', justifyContent:'center', marginTop:14}}
                onClick={() => onToggleFollow(p.handle)}>
                {followed ? '팔로잉 ✓' : '＋ 팔로우'}
              </button>
            )}
          </div>

          <div className="panel">
            <h4>이 키워드 다른 글</h4>
            {related.map(r => (
              <div key={r.id} style={{padding:'10px 0', borderBottom:'1px solid var(--rule-ghost)', cursor:'pointer'}} onClick={() => onNav('detail', r)}>
                <div style={{fontFamily:'var(--f-kr-serif)', fontSize:13.5, fontWeight:700, color:'var(--ink)', letterSpacing:'-0.01em', marginBottom:4}}>{r.title}</div>
                <div className="meta" style={{fontSize:10.5}}>{r.author} · ♥ {r.likes}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
