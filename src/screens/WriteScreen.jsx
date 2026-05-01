import { useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar.jsx';
import { useToast } from '../components/Toast.jsx';

const DRAFT_KEY = 'wh_draft';

export const WriteScreen = ({onNav, onPublish, onSaveDraft, dark, onToggleDark, user, editingPost, editingDraft, drafts = [], localDraft, onLoadDraft, onDeleteDraft, onUpdatePost, onClearEditing, onClearDraftEditing, todayKw}) => {
  const isEditing = !!editingPost;
  const isDraftEditing = !!editingDraft;
  const activeKeywordId = editingDraft?.keywordId || editingDraft?.keyword?.id || todayKw?.id || null;
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [draftMenuOpen, setDraftMenuOpen] = useState(false);
  const [draftId, setDraftId] = useState(editingDraft?.source === 'server' ? editingDraft.id : null);
  const [charCount, setCharCount] = useState(0);
  const editorRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null); // Date | null
  const [savedTick, setSavedTick] = useState(0); // re-render the "N분 전" label
  /* unified toolbar state — one source of truth for all formatting toggles */
  const [tools, setTools] = useState({
    bold:false, italic:false, underline:false, strike:false,
    h1:false, h2:false, h3:false, blockquote:false,
    ul:false, ol:false,
    alignL:false, alignC:false, alignR:false,
    block:'본문',  /* dropdown label */
  });
  const refreshTools = () => {
    if (!editorRef.current) return;
    const isBlock = (tag) => {
      try { return document.queryCommandValue('formatBlock')?.toUpperCase() === tag; } catch { return false; }
    };
    const h1 = isBlock('H1');
    const h2 = isBlock('H2');
    const h3 = isBlock('H3');
    const bq = isBlock('BLOCKQUOTE');
    setTools({
      bold:      document.queryCommandState('bold'),
      italic:    document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike:    document.queryCommandState('strikeThrough'),
      h1, h2, h3, blockquote: bq,
      ul:     document.queryCommandState('insertUnorderedList'),
      ol:     document.queryCommandState('insertOrderedList'),
      alignL: document.queryCommandState('justifyLeft'),
      alignC: document.queryCommandState('justifyCenter'),
      alignR: document.queryCommandState('justifyRight'),
      block:  h1 ? '제목 1' : h2 ? '제목 2' : h3 ? '제목 3' : '본문',
    });
  };
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {}
  }, []);
  /* listen to selection changes anywhere → keep toolbar in sync */
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (sel && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
        refreshTools();
      }
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [commentsOn, setCommentsOn] = useState(true);
  const [visibility, setVisibility] = useState('전체 공개');
  const [visMenuOpen, setVisMenuOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const VISIBILITIES = ['전체 공개', '나만 보기'];

  /* Restore draft (or load editingPost) on mount */
  useEffect(() => {
    if (isEditing) {
      setTitle(editingPost.title || '');
      if (editorRef.current) {
        editorRef.current.innerHTML = editingPost.bodyHtml || '';
        if (!editingPost.bodyHtml) editorRef.current.innerText = editingPost.body || '';
        setCharCount((editingPost.body || '').length);
      }
      return;
    }
    if (isDraftEditing) {
      setTitle(editingDraft.title || '');
      setDraftId(editingDraft.source === 'server' ? editingDraft.id : null);
      if (editorRef.current) {
        const draftHtml = editingDraft.bodyHTML || editingDraft.bodyHtml || '';
        editorRef.current.innerHTML = draftHtml;
        if (!draftHtml) editorRef.current.innerText = editingDraft.body || '';
        setCharCount((editorRef.current.innerText || '').length);
      }
      if (editingDraft.savedAt) setLastSavedAt(new Date(editingDraft.savedAt));
      setRestored(false);
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.title) setTitle(d.title);
      if (d.commentsOn !== undefined) setCommentsOn(d.commentsOn);
      if (d.visibility) {
        // 과거에 저장된 draft가 '팔로워 공개'라면 '전체 공개'로 마이그레이션
        setVisibility(d.visibility === '팔로워 공개' ? '전체 공개' : d.visibility);
      }
      if (d.bodyHTML && editorRef.current) {
        editorRef.current.innerHTML = d.bodyHTML;
        setCharCount((editorRef.current.innerText || '').length);
      }
      if (d.savedAt) setLastSavedAt(new Date(d.savedAt));
      if (d.title || d.bodyHTML) setRestored(true);
    } catch {}
  }, [isEditing, isDraftEditing, editingDraft]);

  /* Auto-save (debounced) on title / body / settings change */
  const writeDraft = async (extra = {}) => {
    try {
      const bodyHTML = editorRef.current?.innerHTML || '';
      const text     = editorRef.current?.innerText || '';
      if (!title.trim() && !text.trim()) {
        localStorage.removeItem(DRAFT_KEY);
        setLastSavedAt(null);
        return;
      }
      const now = new Date();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title, bodyHTML, commentsOn, visibility, keywordId: activeKeywordId, savedAt: now.toISOString(), ...extra,
      }));
      const saved = await onSaveDraft?.({ id: draftId, title, body: text, bodyHTML, commentsOn, visibility, keywordId: activeKeywordId });
      if (saved?.id) {
        setDraftId(saved.id);
        localStorage.removeItem(DRAFT_KEY);
      }
      setLastSavedAt(now);
    } catch {}
  };
  const writeDraftRef = useRef(writeDraft);
  writeDraftRef.current = writeDraft;

  useEffect(() => {
    if (isEditing) return; /* 편집 중에는 글로벌 드래프트를 덮지 않음 */
    const id = setTimeout(() => writeDraftRef.current(), 800);
    return () => clearTimeout(id);
  }, [title, charCount, commentsOn, visibility, isEditing]);

  /* Tick once a minute so the "N분 전" label updates without typing */
  useEffect(() => {
    const id = setInterval(() => setSavedTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const formatSavedLabel = () => {
    if (saving) return '저장 중…';
    if (!lastSavedAt) return '자동 저장 대기';
    const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
    if (diffSec < 5)   return '저장됨 ✓';
    if (diffSec < 60)  return `자동 저장 · ${diffSec}초 전`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)  return `자동 저장 · ${diffMin}분 전`;
    return `자동 저장 · ${Math.floor(diffMin / 60)}시간 전`;
  };
  void savedTick; // keep ESLint happy

  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 0);
      const diff = end - now;
      if (diff <= 0) { setTimeLeft('마감'); return; }
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      setTimeLeft(`${h}H ${m}M ${s}S`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleInput = () => {
    const text = editorRef.current?.innerText || '';
    setCharCount(text.length);
  };

  const execCmd = (cmd, val) => {
    document.execCommand(cmd, false, val ?? null);
    editorRef.current?.focus();
    refreshTools();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    const html = text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join('<br>'))
      .filter(Boolean)
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join('');
    document.execCommand('insertHTML', false, html || text);
    handleInput();
    refreshTools();
  };

  const setBlock = (tag) => {
    /* H1/H2/BLOCKQUOTE/P 토글 — 같은 블록이면 본문(P)으로 되돌림 */
    const cur = (document.queryCommandValue('formatBlock') || '').toUpperCase();
    const next = (cur === tag) ? 'P' : tag;
    document.execCommand('formatBlock', false, `<${next}>`);
    editorRef.current?.focus();
    refreshTools();
    setBlockMenuOpen(false);
  };

  const insertLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      toast('링크로 만들 텍스트를 먼저 선택해주세요.');
      return;
    }
    const url = window.prompt('링크 주소를 입력하세요', 'https://');
    if (!url || url === 'https://') return;
    document.execCommand('createLink', false, url);
    editorRef.current?.focus();
    refreshTools();
  };

  const removeFormat = () => {
    document.execCommand('removeFormat');
    document.execCommand('formatBlock', false, '<P>');
    editorRef.current?.focus();
    refreshTools();
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { writeDraftRef.current(); setSaving(false); toast('임시저장되었습니다 ✓'); }, 400);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setTitle('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setCharCount(0);
    setLastSavedAt(null);
    setRestored(false);
    setDraftId(null);
    onClearDraftEditing?.();
    toast('임시저장이 삭제되었습니다.');
  };

  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);

  /* Keyboard shortcuts: ⌘/Ctrl+Enter → publish, Esc → close modals/discard */
  const handlePublishRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (confirming) { handlePublishRef.current?._confirm(); }
        else            { handlePublishRef.current?._open();    }
      } else if (e.key === 'Escape') {
        if (confirming) { e.preventDefault(); setConfirming(false); }
        else if (visMenuOpen) { e.preventDefault(); setVisMenuOpen(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, visMenuOpen]);

  const handlePublish = () => {
    if (publishing) return;
    const body = editorRef.current?.innerText?.trim() || '';
    if (!title.trim() && !body) { toast('제목과 내용을 입력해주세요.', 'error'); return; }
    if (!title.trim())           { toast('제목을 입력해주세요.', 'error'); return; }
    if (!body)                   { toast('내용을 입력해주세요.', 'error'); return; }
    setConfirming(true);
  };

  const confirmPublish = async () => {
    if (publishing) return;
    const body = editorRef.current?.innerText?.trim() || '';
    const bodyHtml = editorRef.current?.innerHTML || '';
    setConfirming(false);
    setPublishing(true);
    try {
      if (isEditing) {
        const updatedPost = await onUpdatePost(editingPost.id, { title, body, bodyHtml });
        onClearEditing();
        toast('글이 수정되었습니다 ✓');
        onNav('detail', updatedPost || { ...editingPost, title, body, bodyHtml });
      } else {
        await onPublish({ title, body, bodyHtml, draftId, keywordId: activeKeywordId });
        setDraftId(null);
        onClearDraftEditing?.();
        localStorage.removeItem(DRAFT_KEY);
        toast('글이 발행되었습니다 ✓');
        onNav('feed');
      }
    } catch {
      setConfirming(false);
    } finally {
      setPublishing(false);
    }
  };

  /* expose to keyboard shortcut handler */
  handlePublishRef.current = { _open: handlePublish, _confirm: confirmPublish };

  const readMin = Math.max(1, Math.ceil(charCount / 350));

  const draftItems = (() => {
    const remote = (drafts || []).map(d => ({
      ...d, source: 'server', savedAt: d.updatedAt || d.createdAt,
    }));
    if (!localDraft) return remote;
    const localItem = {
      id: 'local',
      title: localDraft.title || '제목 없는 초안',
      body: localDraft.body || '',
      bodyHTML: localDraft.bodyHTML,
      bodyHtml: localDraft.bodyHTML,
      savedAt: localDraft.savedAt,
      source: 'local',
    };
    return [localItem, ...remote];
  })();

  const draftCount = draftItems.length;
  const currentDraftId = isDraftEditing
    ? (editingDraft?.source === 'local' ? 'local' : editingDraft?.id)
    : null;

  const formatDraftTime = (value) => {
    if (!value) return '저장 시간 없음';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '저장 시간 없음';
    return date.toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  };

  const handlePickDraft = (draft) => {
    if (currentDraftId && (draft.source === 'local' ? 'local' : draft.id) === currentDraftId) {
      setDraftMenuOpen(false);
      return;
    }
    const body = editorRef.current?.innerText?.trim() || '';
    const dirty = !isDraftEditing && (title.trim() || body);
    if (dirty && !window.confirm('작성 중인 내용을 두고 다른 임시저장글을 불러올까요?')) return;
    setDraftMenuOpen(false);
    onLoadDraft?.(draft);
  };

  return (
    <div onClick={() => {
      if (blockMenuOpen) setBlockMenuOpen(false);
      if (draftMenuOpen) setDraftMenuOpen(false);
    }}>
      <TopBar active="write" onNav={onNav} dark={dark} onToggleDark={onToggleDark} right={
        <div className="write-actions" style={{display:'flex', alignItems:'center', gap:12}}>
          <span className="meta write-saved-label" style={{fontSize:11}}>{isEditing ? '편집 모드' : formatSavedLabel()}</span>
          <button className="btn sm ghost write-action-cancel" onClick={() => {
            const body = editorRef.current?.innerText?.trim() || '';
            const dirty = isEditing
              ? (title !== editingPost.title || body !== (editingPost.body || '').trim())
              : (title.trim() || body);
            if (dirty && !window.confirm(isEditing ? '수정한 내용을 버리고 나가시겠어요?' : '작성 중인 글을 버리고 나가시겠어요?')) return;
            if (isEditing) onClearEditing();
            if (isDraftEditing) onClearDraftEditing?.();
            onNav(isEditing ? 'detail' : 'feed', isEditing ? editingPost : undefined);
          }}>취소</button>
          {!isEditing && <button className="btn sm write-action-save" onClick={handleSave}>임시저장</button>}
          {!isEditing && (
            <div className="write-action-load-wrap" style={{position:'relative'}} onClick={e => e.stopPropagation()}>
              <button className="btn sm ghost write-action-load" onClick={() => setDraftMenuOpen(o => !o)}
                title={draftCount === 0 ? '저장된 임시저장글이 없습니다' : '임시저장글 불러오기'}
                style={{opacity: draftCount === 0 ? 0.5 : 1}}>
                불러오기 {draftCount > 0 && <span style={{fontFamily:'var(--f-mono)', marginLeft:4, color:'var(--ink-mute)'}}>{draftCount}</span>} ▾
              </button>
              {draftMenuOpen && (
                <div className="draft-menu" style={{
                  position:'absolute', right:0, top:'calc(100% + 6px)', zIndex:40,
                  background:'var(--card)', border:'1px solid var(--rule-soft)', borderRadius:4,
                  boxShadow:'0 12px 32px rgba(0,0,0,0.12)', width:340, maxHeight:420, overflowY:'auto',
                }}>
                  <div className="meta" style={{fontSize:10, padding:'10px 14px 6px', borderBottom:'1px solid var(--rule-ghost)', color:'var(--ink-mute)'}}>
                    임시저장글 · {draftCount}편
                  </div>
                  {draftCount === 0 && (
                    <div style={{padding:'24px 14px', textAlign:'center'}}>
                      <div style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:15, color:'var(--ink)', marginBottom:6}}>
                        불러올 임시저장글이 없습니다
                      </div>
                      <div className="meta" style={{fontSize:10.5, lineHeight:1.55}}>
                        글을 쓰면 자동으로 저장되고 이곳에 표시됩니다.
                      </div>
                    </div>
                  )}
                  {draftItems.map(d => {
                    const id = d.source === 'local' ? 'local' : d.id;
                    const isCurrent = currentDraftId === id;
                    return (
                      <div key={`${d.source}-${id}`} style={{
                        padding:'10px 14px', borderBottom:'1px solid var(--rule-ghost)',
                        background: isCurrent ? 'var(--paper-2)' : 'transparent',
                        display:'flex', gap:8, alignItems:'flex-start',
                      }}>
                        <div style={{flex:1, minWidth:0, cursor: isCurrent ? 'default' : 'pointer'}}
                          onClick={() => handlePickDraft(d)}>
                          <div style={{
                            fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:13.5,
                            color:'var(--ink)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                          }}>
                            {d.title || '제목 없는 초안'}
                          </div>
                          <div className="meta" style={{fontSize:10, marginTop:3, color:'var(--ink-mute)'}}>
                            {d.source === 'local' ? 'LOCAL' : 'SERVER'} · {formatDraftTime(d.savedAt)}
                            {isCurrent && <span style={{marginLeft:6, color:'var(--accent)'}}>● 현재</span>}
                          </div>
                          {d.body && (
                            <div style={{fontSize:11.5, color:'var(--ink-mute)', marginTop:4, lineHeight:1.5,
                              display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                              {d.body}
                            </div>
                          )}
                        </div>
                        {onDeleteDraft && (
                          <button className="btn sm ghost" style={{padding:'2px 6px', fontSize:10, color:'var(--accent)', flexShrink:0}}
                            onClick={() => { onDeleteDraft(d); }}>삭제</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <button className="btn sm accent write-action-publish" onClick={handlePublish} disabled={publishing} title="⌘+Enter">
            {publishing ? (isEditing ? '수정 중…' : '발행 중…') : (isEditing ? '수정 완료' : '발행하기')} <span className="arr">→</span>
          </button>
        </div>
      }/>
      <div className="wrap-narrow write-wrap" style={{paddingTop:40}}>
        {isEditing && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
            padding:'10px 14px', marginBottom:20,
            border:'1px solid var(--ink-mute)', background:'var(--paper-2)',
            fontFamily:'var(--f-kr)', fontSize:12.5, color:'var(--ink-soft)',
          }}>
            <span>이전에 발행한 글을 편집 중입니다 <span className="meta" style={{marginLeft:6}}>· {editingPost.time}</span></span>
            <span className="meta" style={{fontSize:10.5}}>NO. {String(editingPost.id).slice(-4)}</span>
          </div>
        )}
        {isDraftEditing && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
            padding:'10px 14px', marginBottom:20,
            border:'1px solid var(--accent)', background:'var(--accent-soft)',
            fontFamily:'var(--f-kr)', fontSize:12.5, color:'var(--ink-soft)',
          }}>
            <span>임시저장글을 이어 쓰는 중입니다 <span className="meta" style={{marginLeft:6}}>· {formatSavedLabel()}</span></span>
            <span style={{display:'flex', gap:8}}>
              <button className="btn sm ghost" style={{padding:'4px 10px', fontSize:10.5}} onClick={() => setDraftMenuOpen(true)}>다른 초안</button>
              <button className="btn sm ghost" style={{padding:'4px 10px', fontSize:10.5, color:'var(--accent)'}} onClick={handleDiscardDraft}>새로 시작</button>
            </span>
          </div>
        )}
        {!isEditing && restored && (
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center', gap:12,
            padding:'10px 14px', marginBottom:20,
            border:'1px solid var(--accent)', background:'var(--accent-soft)',
            fontFamily:'var(--f-kr)', fontSize:12.5, color:'var(--ink-soft)',
          }}>
            <span>이전에 작성하던 글을 불러왔습니다 {lastSavedAt && <span className="meta" style={{marginLeft:6}}>· {formatSavedLabel()}</span>}</span>
            <span style={{display:'flex', gap:8}}>
              <button className="btn sm ghost" style={{padding:'4px 10px', fontSize:10.5}} onClick={() => setRestored(false)}>이어쓰기</button>
              <button className="btn sm ghost" style={{padding:'4px 10px', fontSize:10.5, color:'var(--accent)'}} onClick={handleDiscardDraft}>새로 시작</button>
            </span>
          </div>
        )}
        {/* Keyword strip */}
        <div className="write-keyword-strip" style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', paddingBottom:20, borderBottom:'1px solid var(--rule-soft)', marginBottom:28}}>
          <div>
            <div className="eyebrow" style={{marginBottom:8}}>오늘의 키워드 · No. {todayKw.no}</div>
            <div style={{fontFamily:'var(--f-kw)', fontSize:36, fontWeight:400, letterSpacing:'-0.02em', color:'var(--ink)'}}>
              {todayKw.word} <span style={{color:'var(--ink-faint)', fontFamily:'var(--f-serif)', fontSize:22, marginLeft:8}}>{todayKw.eng.charAt(0) + todayKw.eng.slice(1).toLowerCase()}</span>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div className="meta" style={{fontSize:10.5}}>마감 · 23:59</div>
            <div className="meta" style={{fontSize:10.5}}>{timeLeft} 남음</div>
          </div>
        </div>

        {/* Title */}
        <input
          className="field"
          placeholder="제목을 입력하세요"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{fontFamily:'var(--f-kr-serif)', fontSize:32, fontWeight:400, letterSpacing:'-0.02em', padding:'8px 0', borderBottom:'none', marginBottom:4, width:'100%'}}
        />
        <div className="rule-s" style={{marginBottom:22}}></div>

        {/* Editor */}
        <div className="editor-shell">
          <div className="editor-toolbar">
            {/* 블록 타입 셀렉트 */}
            <div className="toolbar-group" style={{position:'relative'}}>
              <div className="tsel" style={{cursor:'pointer', userSelect:'none'}}
                onClick={() => setBlockMenuOpen(o => !o)} title="블록 타입">
                <span>{tools.block}</span>
                <span style={{color:'var(--ink-mute)', fontSize:9, marginLeft:4}}>▾</span>
              </div>
              {blockMenuOpen && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:30,
                  background:'var(--card)', border:'1px solid var(--rule-soft)',
                  boxShadow:'0 8px 24px rgba(0,0,0,0.08)', minWidth:140,
                }} onClick={e => e.stopPropagation()}>
                  {[
                    ['P',  '본문',   {fontSize:14, fontFamily:'var(--f-kr-serif)'}],
                    ['H1', '제목 1', {fontSize:18, fontFamily:'var(--f-kr-serif)', fontWeight:700}],
                    ['H2', '제목 2', {fontSize:16, fontFamily:'var(--f-kr-serif)', fontWeight:700}],
                    ['H3', '제목 3', {fontSize:15, fontFamily:'var(--f-kr-serif)', fontWeight:700}],
                  ].map(([tag, label, st]) => (
                    <button key={tag} onMouseDown={e => { e.preventDefault(); setBlock(tag); }}
                      style={{display:'block', width:'100%', textAlign:'left', padding:'10px 14px',
                        background:'none', border:'none', cursor:'pointer', color:'var(--ink-soft)',
                        ...st}}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 텍스트 서식 */}
            <div className="toolbar-group">
              <button className={`tbtn${tools.bold?' active':''}`}      onMouseDown={e=>{e.preventDefault();execCmd('bold')}}        title="굵게 (⌘B)"><b>B</b></button>
              <button className={`tbtn${tools.italic?' active':''}`}    onMouseDown={e=>{e.preventDefault();execCmd('italic')}}      title="기울임 (⌘I)" style={{fontStyle:'italic', fontFamily:'var(--f-serif)'}}>I</button>
              <button className={`tbtn${tools.underline?' active':''}`} onMouseDown={e=>{e.preventDefault();execCmd('underline')}}   title="밑줄 (⌘U)" style={{textDecoration:'underline'}}>U</button>
              <button className={`tbtn${tools.strike?' active':''}`}    onMouseDown={e=>{e.preventDefault();execCmd('strikeThrough')}} title="취소선" style={{textDecoration:'line-through'}}>S</button>
            </div>

            {/* 정렬 */}
            <div className="toolbar-group">
              <button className={`tbtn${tools.alignL?' active':''}`} onMouseDown={e=>{e.preventDefault();execCmd('justifyLeft')}} title="왼쪽 정렬">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M4 12h10M4 18h16"/></svg>
              </button>
              <button className={`tbtn${tools.alignC?' active':''}`} onMouseDown={e=>{e.preventDefault();execCmd('justifyCenter')}} title="가운데 정렬">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M7 12h10M4 18h16"/></svg>
              </button>
              <button className={`tbtn${tools.alignR?' active':''}`} onMouseDown={e=>{e.preventDefault();execCmd('justifyRight')}} title="오른쪽 정렬">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M10 12h10M4 18h16"/></svg>
              </button>
            </div>

            {/* 목록 */}
            <div className="toolbar-group">
              <button className={`tbtn${tools.ul?' active':''}`} onMouseDown={e=>{e.preventDefault();execCmd('insertUnorderedList')}} title="글머리 목록">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5" cy="7" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="5" cy="17" r="1.2"/><path d="M9 7h11M9 12h11M9 17h11"/></svg>
              </button>
              <button className={`tbtn${tools.ol?' active':''}`} onMouseDown={e=>{e.preventDefault();execCmd('insertOrderedList')}} title="번호 매기기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 7h11M9 12h11M9 17h11"/><text x="2" y="9" fontSize="6" fill="currentColor" stroke="none">1.</text><text x="2" y="14" fontSize="6" fill="currentColor" stroke="none">2.</text><text x="2" y="19" fontSize="6" fill="currentColor" stroke="none">3.</text></svg>
              </button>
              <button className={`tbtn${tools.blockquote?' active':''}`} onMouseDown={e=>{e.preventDefault();setBlock('BLOCKQUOTE')}} title="인용구">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 7h4v6H5v-2a4 4 0 0 1 2-4zM17 7h4v6h-6v-2a4 4 0 0 1 2-4z"/></svg>
              </button>
            </div>

            {/* 삽입·정리 */}
            <div className="toolbar-group">
              <button className="tbtn" onMouseDown={e=>{e.preventDefault();insertLink()}} title="링크 삽입">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
              </button>
              <button className="tbtn" onMouseDown={e=>{e.preventDefault();execCmd('undo')}} title="실행 취소 (⌘Z)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7"/></svg>
              </button>
              <button className="tbtn" onMouseDown={e=>{e.preventDefault();execCmd('redo')}} title="다시 실행 (⌘⇧Z)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7"/></svg>
              </button>
              <button className="tbtn" onMouseDown={e=>{e.preventDefault();removeFormat()}} title="서식 지우기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 6h14M9 6l-3 14h3M19 6l-2 9"/><path d="M14 17l5 5M19 17l-5 5"/></svg>
              </button>
            </div>

          </div>

          <div
            ref={editorRef}
            className="editor-body"
            contentEditable
            suppressContentEditableWarning
            data-placeholder={`오늘의 키워드 '${todayKw.word}'에 대해 자유롭게 써보세요…`}
            onInput={() => { handleInput(); refreshTools(); }}
            onPaste={handlePaste}
            onKeyUp={refreshTools}
            onMouseUp={refreshTools}
            onFocus={refreshTools}
          />

          <div className="editor-footer">
            <span>글자 · {charCount.toLocaleString()} / 제한 없음 · {readMin}분 분량</span>
            <span style={{display:'flex', gap:16}}>
              <span style={{position:'relative', cursor:'pointer', userSelect:'none'}} onClick={() => setVisMenuOpen(o => !o)}>
                공개 · {visibility} ▾
                {visMenuOpen && (
                  <span style={{position:'absolute', bottom:'calc(100% + 8px)', left:0, background:'var(--card)', border:'1px solid var(--rule-soft)', borderRadius:4, boxShadow:'0 8px 24px rgba(0,0,0,0.08)', zIndex:200, minWidth:130, display:'flex', flexDirection:'column'}}>
                    {VISIBILITIES.map(v => (
                      <span key={v} onClick={e => { e.stopPropagation(); setVisibility(v); setVisMenuOpen(false); }}
                        style={{padding:'9px 14px', fontFamily:'var(--f-kr)', fontSize:13, color: v===visibility ? 'var(--accent)' : 'var(--ink-soft)', background:'none', whiteSpace:'nowrap'}}>
                        {v===visibility ? '✓ ' : ''}{v}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span style={{cursor:'pointer', userSelect:'none'}} onClick={() => setCommentsOn(c => !c)}>
                댓글 · {commentsOn ? '허용 ✓' : '비허용 —'}
              </span>
            </span>
          </div>
        </div>

        {/* Tips */}
        <div style={{marginTop:32, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24}}>
          {[
            ['01','작게 시작하기','한 문장으로 시작해도 괜찮습니다. 짧은 글이 오래 남습니다.'],
            ['02','솔직하게','꾸미지 않은 감정은 언젠가 누군가에게 위로가 됩니다.'],
            ['03','나의 속도로','하루에 한 번, 꾸준히. 스트릭이 당신의 기록이 됩니다.'],
          ].map(([n,t,d]) => (
            <div key={n} style={{borderTop:'1px solid var(--rule)', paddingTop:14}}>
              <div className="label" style={{fontSize:10, marginBottom:8}}>{n} · TIP</div>
              <div style={{fontFamily:'var(--f-kr-serif)', fontSize:16, fontWeight:700, marginBottom:6, color:'var(--ink)'}}>{t}</div>
              <div style={{fontSize:12.5, color:'var(--ink-mute)', lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Publish confirmation modal */}
      {confirming && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center'}}
          onClick={() => !publishing && setConfirming(false)}>
          <div style={{background:'var(--card)', border:'1px solid var(--rule-soft)', borderRadius:4, padding:36, maxWidth:380, width:'90%', boxShadow:'0 16px 48px rgba(0,0,0,0.12)'}}
            onClick={e => e.stopPropagation()}>
            <div className="eyebrow" style={{marginBottom:12}}>{isEditing ? '수정 확인' : '발행 확인'}</div>
            <h3 style={{fontFamily:'var(--f-kr-serif)', fontSize:22, fontWeight:700, letterSpacing:'-0.02em', color:'var(--ink)', margin:'0 0 8px'}}>{title}</h3>
            <p style={{fontSize:13, color:'var(--ink-mute)', lineHeight:1.6, margin:'0 0 24px'}}>
              {isEditing
                ? <>이 글의 변경사항을 저장합니다.<br/>독자에게 보이는 글이 즉시 갱신됩니다.</>
                : <>이 글을 오늘의 키워드 <strong style={{color:'var(--ink)'}}>{todayKw.word}</strong>에 발행합니다.<br/>발행 후에는 수정이 가능합니다.</>}
            </p>
            <div style={{display:'flex', gap:10, justifyContent:'space-between', alignItems:'center'}}>
              <span className="meta" style={{fontSize:10}}>⌘+Enter · 발행 · Esc · 취소</span>
              <span style={{display:'flex', gap:10}}>
                <button className="btn sm ghost" onClick={() => setConfirming(false)} disabled={publishing}>취소</button>
                <button className="btn sm accent" onClick={confirmPublish} disabled={publishing} title="⌘+Enter">
                  {publishing ? (isEditing ? '수정 중…' : '발행 중…') : (isEditing ? '수정 완료' : '발행하기')} <span className="arr">→</span>
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
