import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar.jsx';
import { IconBookmark, IconComment, IconHeart } from '../components/Icons.jsx';
import { ReportModal } from '../components/ReportModal.jsx';
import { useToast } from '../components/Toast.jsx';
import { createComment, deleteComment, listComments } from '../lib/api.js';
import { readJSON, readString } from '../lib/storage.js';

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const textToArticleHtml = (value = '') =>
  value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');

const sanitizeArticleHtml = (html = '') => {
  if (!html.trim() || typeof DOMParser === 'undefined') return '';
  const allowedTags = new Set(['P', 'BR', 'H1', 'H2', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'A', 'DIV']);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const cleanNode = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(child.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(child.tagName)) {
          child.remove();
          return;
        }
        child.replaceWith(...child.childNodes);
        cleanNode(node);
        return;
      }

      const textAlign = child.style?.textAlign;
      const href = child.getAttribute('href') || '';
      [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
      if (child.tagName === 'A') {
        if (/^https?:\/\//i.test(href) || href.startsWith('mailto:')) {
          child.setAttribute('href', href);
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noreferrer');
        }
      }
      if (['left', 'center', 'right'].includes(textAlign)) {
        child.style.textAlign = textAlign;
      }
      cleanNode(child);
    });
  };

  cleanNode(root);

  // 빈 단락 제거 — 사용자가 Enter 두 번 눌러서 생긴 <p></p>, <p><br></p>,
  // 공백/&nbsp;만 있는 단락을 시각적으로 빈 줄 만들지 않게 정리.
  const isEmptyParagraph = (el) => {
    if (!(el.tagName === 'P' || el.tagName === 'DIV')) return false;
    const text = (el.textContent || '').replace(/ /g, '').trim();
    if (text) return false;
    // <br> 만 있어도 빈 단락으로 취급
    return [...el.children].every((c) => c.tagName === 'BR');
  };
  [...root.querySelectorAll('p, div')]
    .filter(isEmptyParagraph)
    .forEach((el) => el.remove());

  return root.innerHTML;
};

const getArticleHtml = (post) => sanitizeArticleHtml(post.bodyHtml || '') || textToArticleHtml(post.body || '');

const formatPostDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(/\. /g, '·').replace(/\.$/, '');
};

export const DetailScreen = ({post, onNav, posts, onToggleLike, onToggleBookmark, user, onEditPost, onDeletePost, blocks, follows, onToggleFollow, onReport, onBlockAuthor, todayKw, stats}) => {
  const toast = useToast();
  const p = post || posts[0];
  const postIndex = posts.findIndex(x => x.id === p.id);
  const currentKeyword = p?.keyword || todayKw;
  const isMine = user && (p?.handle === user.handle || p?.author === user.nickname);
  const isBlocked = blocks?.has(p.handle);

  const [reportTarget, setReportTarget] = useState(null); // {type, id, handle, label}
  const [moreOpen, setMoreOpen] = useState(false);

  const handleEdit = () => onEditPost(p);
  const handleDelete = async () => {
    if (!window.confirm('이 글을 삭제할까요? 댓글도 함께 사라지고 되돌릴 수 없습니다.')) return;
    try {
      await onDeletePost(p.id);
      toast('글이 삭제되었습니다.');
      onNav('feed');
    } catch {}
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
  const [commenting, setCommenting] = useState(false);
  const [commentsSource, setCommentsSource] = useState('local');
  const [comments, setComments] = useState(() => {
    const all = readJSON('wh_comments', {});
    return all[p.id] || [];
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
        setComments(all[p.id] || []);
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
    if (commenting || !commentText.trim()) return;
    if (!user) {
      toast('댓글을 남기려면 로그인이 필요합니다.', 'error');
      return;
    }
    const body = commentText.trim();
    const token = readString('wh_auth_token');
    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      id: tempId,
      postId: p.id,
      authorId: user?.id,
      n: user?.nickname || '사용자',
      i: user?.nickname?.[0] || '?',
      handle: user?.handle,
      avatarUrl: user?.avatarUrl || null,
      t: '방금',
      body,
      cl: 0,
      liked: false,
      replyOpen: false,
      replyText: '',
      pending: true,
    };
    setCommenting(true);
    setCommentText('');

    if (token && typeof p.id === 'string') {
      setComments(c => [optimisticComment, ...c]);
      setCommentsSource('server');
      try {
        const { comment } = await createComment({ postId: p.id, body, token });
        setComments(c => c.map(item => item.id === tempId ? comment : item));
        setCommenting(false);
        return;
      } catch (error) {
        setComments(c => c.filter(item => item.id !== tempId));
        if (error.status !== 503) {
          toast(error.message || '댓글 등록에 실패했습니다.', 'error');
          setCommentText(body);
          setCommenting(false);
          return;
        }
      }
    }

    setComments(c => [{...optimisticComment, id: Date.now(), pending: false}, ...c]);
    setCommentsSource('local');
    setCommenting(false);
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
    if (!user) {
      toast('답글을 남기려면 로그인이 필요합니다.', 'error');
      return;
    }
    setComments(cs => cs.map(c => {
      if (c.id !== id || !c.replyText?.trim()) return c;
      return {...c, replyOpen: false, replyText: '', replies: [...(c.replies||[]), {
        n: user?.nickname || '사용자',
        i: user?.nickname?.[0] || '?',
        avatarUrl: user?.avatarUrl || null,
        t: '방금',
        body: c.replyText,
      }]};
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
                {p.author}
              </div>
              <div className="meta" style={{fontSize:11, marginTop:2}}>
                {formatPostDate(p.createdAt) || p.time} · 읽기 {p.read}
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
                      {isBlocked ? '차단 해제' : `${p.author} 차단`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="article-body" dangerouslySetInnerHTML={{ __html: getArticleHtml(p) }} />

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
              <Avatar url={user?.avatarUrl} initial={user?.nickname?.[0] || '?'} size={36} />
              <div>
                <textarea
                  className="field"
                  placeholder="이 글에 대한 생각을 남겨주세요"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  style={{minHeight:60, resize:'none', padding:'10px 0', background:'transparent', outline:'none', fontFamily:'var(--f-kr)', fontSize:14, color:'var(--ink)', letterSpacing:'-0.005em', width:'100%', border:'none', borderBottom:'1px solid var(--rule-soft)'}}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleComment(); } }}
                  disabled={commenting}
                />
                <div style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
                  <span className="meta">⌘/Ctrl + Enter로 등록</span>
                  <button className="btn sm solid" onClick={handleComment} disabled={commenting || !commentText.trim()}>
                    {commenting ? '등록 중…' : '댓글 남기기'}
                  </button>
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
                      <span className="c-time">{c.pending ? '등록 중…' : c.t}</span>
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
                        <Avatar url={user?.avatarUrl} initial={user?.nickname?.[0] || '?'} size={28} fontSize={11} />
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
                        <Avatar url={r.avatarUrl} initial={r.i || '?'} size={28} fontSize={11} />
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
              <span>오늘 작성</span><span style={{fontWeight:600, fontVariantNumeric:'tabular-nums'}}>{(stats?.todayPosts ?? 0).toLocaleString()}</span>
            </div>
            <button className="btn sm accent" style={{width:'100%', justifyContent:'center', marginTop:16}} onClick={() => onNav('write')}>
              나도 쓰기 <span className="arr">→</span>
            </button>
          </div>

          {p.authorBio && (
          <div className="panel">
            <h4>작가 소개</h4>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
              <Avatar url={p.avatarUrl} initial={p.initial} size={44} fontSize={17}
                style={{cursor:'pointer'}} onClick={() => onNav('profile', p)} />
              <div>
                <div style={{fontWeight:600, fontSize:14}}>{p.author}</div>
              </div>
            </div>
            <p style={{fontSize:12.5, color:'var(--ink-mute)', lineHeight:1.6, margin:'12px 0'}}>
              {p.authorBio}
            </p>
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
          )}

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
