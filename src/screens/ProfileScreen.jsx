import { useEffect, useRef, useState } from 'react';
import { checkHandleAvailable, sanitizeHandle } from '../lib/handles.js';
import { getMyProfile, getPublicProfile, resolveAssetUrl, uploadAvatar } from '../lib/api.js';
import { Avatar } from '../components/Avatar.jsx';
import { readString } from '../lib/storage.js';
import { useToast } from '../components/Toast.jsx';

const STREAK_PERIODS = {
  '30일': { key: '30' },
  '90일': { key: '90' },
  '1년':  { key: '365' },
};

const formatNumber = (value) => Number(value || 0).toLocaleString('ko-KR');
const formatJoinDate = (date) => {
  if (!date) return 'WRITER';
  const joined = new Date(date);
  if (Number.isNaN(joined.getTime())) return 'WRITER';
  return `WRITER · SINCE ${joined.getFullYear()}·${String(joined.getMonth() + 1).padStart(2, '0')}`;
};
const profileToUserListItem = (profile) => ({
  name: profile.displayName || profile.author || profile.name || profile.handle,
  handle: profile.handle,
  bio: profile.bio || '',
  avatarUrl: profile.avatarUrl || null,
  initial: profile.initial || profile.displayName?.[0] || profile.name?.[0] || '?',
});

export const ProfileScreen = ({onNav, posts, user, viewUser, onLogout, onUpdateUser, onEditPost, onDeletePost, blocks, follows, onToggleFollow, onBlockAuthor}) => {
  const toast = useToast();
  const isOwnProfile = !viewUser;
  const followed = viewUser ? follows?.has(viewUser.handle) : false;

  const [remoteProfile, setRemoteProfile] = useState(null);
  const [profileTab, setProfileTab] = useState('글');
  const [streakPeriod, setStreakPeriod] = useState('30일');
  const [editing, setEditing] = useState(false);
  const [editNick, setEditNick] = useState(user?.nickname || '');
  const [editBio,  setEditBio]  = useState(user?.bio || '');
  const [editNickStatus, setEditNickStatus] = useState('ok');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef(null);

  useEffect(() => { setProfileTab('글'); }, [viewUser?.handle]);

  useEffect(() => {
    let cancelled = false;
    const token = readString('wh_auth_token');
    const load = async () => {
      try {
        const result = isOwnProfile && token
          ? await getMyProfile(token)
          : viewUser?.handle
            ? await getPublicProfile(viewUser.handle)
            : null;
        if (!cancelled) setRemoteProfile(result?.profile || null);
      } catch (error) {
        if (!cancelled) setRemoteProfile(null);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isOwnProfile, viewUser?.handle, user?.handle, user?.updatedAt]);

  const editHandlePreview = sanitizeHandle(editNick);

  useEffect(() => {
    if (!editing) return;
    if (!editHandlePreview || editHandlePreview.length < 2) { setEditNickStatus('idle'); return; }
    if (editHandlePreview === user?.handle) { setEditNickStatus('ok'); return; }
    setEditNickStatus('checking');
    let cancelled = false;
    const id = setTimeout(async () => {
      const knownHandles = [
        ...posts.map(p => p.handle),
        ...(remoteProfile?.followers || []).map(u => u.handle),
        ...(remoteProfile?.following || []).map(u => u.handle),
      ];
      const r = await checkHandleAvailable(editHandlePreview, user?.handle, knownHandles);
      if (!cancelled) setEditNickStatus(r);
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [editHandlePreview, editing, user?.handle, posts, remoteProfile?.followers, remoteProfile?.following]);

  const profileUser = remoteProfile || (viewUser ? {
    displayName: viewUser.author,
    handle: viewUser.handle,
    bio: viewUser.bio || '',
    avatarUrl: viewUser.avatarUrl || null,
    initial: viewUser.initial,
  } : {
    displayName: user?.nickname,
    handle: user?.handle || sanitizeHandle(user?.nickname || 'user') || 'user',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || null,
    initial: user?.nickname?.[0],
  });
  const name    = profileUser.displayName || profileUser.name || profileUser.author || '사용자';
  const handle  = profileUser.handle || 'user';
  const bio     = profileUser.bio || '소개가 없습니다.';
  const initial = profileUser.initial || name[0];

  const openEdit = () => {
    setEditNick(user?.nickname || '');
    setEditBio(user?.bio || '');
    setEditAvatarUrl(user?.avatarUrl || '');
    setEditing(true);
  };

  const handlePickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('이미지 파일만 업로드할 수 있습니다.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024)     { toast('이미지는 5MB 이하만 가능합니다.', 'error'); return; }
    const token = readString('wh_auth_token');
    if (!token) { toast('로그인이 필요합니다.', 'error'); return; }
    setAvatarUploading(true);
    try {
      const { url } = await uploadAvatar({ file, token });
      setEditAvatarUrl(url);
      toast('이미지가 업로드되었습니다.');
    } catch (error) {
      toast(error.message || '이미지 업로드에 실패했습니다.', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveEdit = async () => {
    const nn = editNick.trim();
    if (!nn)              { toast('닉네임을 입력해주세요.', 'error'); return; }
    if (nn.length < 2)    { toast('닉네임은 2자 이상이어야 합니다.', 'error'); return; }
    if (nn.length > 20)   { toast('닉네임은 20자 이하여야 합니다.', 'error'); return; }
    if (editBio.length > 80) { toast('소개는 80자 이하여야 합니다.', 'error'); return; }
    if (editNickStatus === 'taken')    { toast('이미 사용 중인 닉네임입니다.', 'error'); return; }
    if (editNickStatus === 'checking') { toast('닉네임 확인이 끝나고 다시 시도해주세요.', 'error'); return; }
    const newHandle = sanitizeHandle(nn) || 'user';
    try {
      await onUpdateUser({ nickname: nn, handle: newHandle, bio: editBio.trim(), avatarUrl: editAvatarUrl || null });
      setEditing(false);
      toast('프로필이 수정되었습니다 ✓');
    } catch {}
  };

  const saveEditRef = useRef(saveEdit);
  saveEditRef.current = saveEdit;
  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEditRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const { key: streakKey } = STREAK_PERIODS[streakPeriod];
  const streakActivity = remoteProfile?.stats?.streak?.activity?.[streakKey] || [];
  const streakData = streakActivity.map((active, i) => (
    i === streakActivity.length - 1 && remoteProfile?.stats?.streak?.completedToday ? 'today' : active ? 'on' : 'off'
  ));
  const streakLabels = remoteProfile?.stats?.streakLabels?.[streakKey] || [];

  const myPosts      = remoteProfile?.posts || posts.filter(p => p.handle === handle || p.author === name);
  const savedPosts   = remoteProfile?.bookmarkedPosts || posts.filter(p => p.bookmarked);
  const likedPosts   = remoteProfile?.likedPosts || posts.filter(p => p.liked);
  const followersList = remoteProfile?.followers || [];
  const followingList = remoteProfile?.following || [];
  const profileStats = remoteProfile?.stats || {};
  const statsRows = [
    ['누적 글', formatNumber(profileStats.posts), '편'],
    ['총 분량', formatNumber(profileStats.characters), '자'],
    ['받은 ♥', formatNumber(profileStats.receivedLikes), ''],
    ['팔로워', formatNumber(profileStats.followers), ''],
    ['현재 스트릭', formatNumber(profileStats.streak?.current), '일'],
  ];

  const handleShare = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://write-habit-web.vercel.app';
    const url = `${origin}/@${handle}`;
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    toast(`프로필 링크가 복사되었습니다 · @${handle}`);
  };

  const handleCardEdit = (e, p) => {
    e.stopPropagation();
    onEditPost(p);
  };
  const handleCardDelete = (e, p) => {
    e.stopPropagation();
    if (!window.confirm(`"${p.title}" 을(를) 삭제할까요?`)) return;
    onDeletePost(p.id);
    toast('글이 삭제되었습니다.');
  };

  const renderPosts = (list, opts = {}) => {
    const { mine = false } = opts;
    if (!list.length) return (
      <div style={{padding:'48px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:12}}>
        아직 글이 없습니다.
      </div>
    );
    return (
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:0}}>
        {list.slice(0,8).map((p, i) => (
          <article key={p.id} style={{padding:24, borderRight:i%2===0?'1px solid var(--rule-ghost)':'none', borderBottom:'1px solid var(--rule-ghost)', cursor:'pointer', position:'relative'}}
            onClick={() => onNav('detail', p)}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
              <span className="meta" style={{fontSize:10.5}}>KW · {p.keyword?.word || '자유'}{p.edited && ' · 수정됨'}</span>
              <span className="meta" style={{fontSize:10.5}}>{p.time || ''}</span>
            </div>
            <h3 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:19, letterSpacing:'-0.02em', lineHeight:1.3, margin:'0 0 10px', color:'var(--ink)'}}>{p.title}</h3>
            <p style={{fontSize:13, color:'var(--ink-mute)', lineHeight:1.65, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{p.body}</p>
            <div style={{display:'flex', gap:14, marginTop:14, fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-mute)'}}>
              <span>♥ <span style={{color:'var(--ink)'}}>{p.likes}</span></span>
              <span>💬 <span style={{color:'var(--ink)'}}>{p.comments}</span></span>
              {mine && (
                <span style={{display:'flex', gap:8, marginLeft:8}}>
                  <button className="btn sm ghost" style={{padding:'2px 8px', fontSize:10}} onClick={e => handleCardEdit(e, p)}>수정</button>
                  <button className="btn sm ghost" style={{padding:'2px 8px', fontSize:10, color:'var(--accent)'}} onClick={e => handleCardDelete(e, p)}>삭제</button>
                </span>
              )}
              <span style={{marginLeft:'auto'}}>{p.read} 읽기</span>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderUserList = (users, opts = {}) => (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:0}}>
      {users.map((u, i) => (
        <div key={u.handle} style={{padding:'20px 24px', borderRight:i%2===0?'1px solid var(--rule-ghost)':'none', borderBottom:'1px solid var(--rule-ghost)', display:'flex', gap:16, alignItems:'center'}}>
          <Avatar url={u.avatarUrl} initial={u.name[0]} size={44} fontSize={18}
            style={{flexShrink:0, cursor:'pointer'}}
            onClick={() => onNav('profile', { handle:u.handle, author:u.name, initial:u.initial || u.name[0], avatarUrl:u.avatarUrl, bio:u.bio })} />
          <div style={{minWidth:0, flex:1, cursor:'pointer'}}
            onClick={() => onNav('profile', { handle:u.handle, author:u.name, initial:u.initial || u.name[0], avatarUrl:u.avatarUrl, bio:u.bio })}>
            <div style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:15, color:'var(--ink)'}}>{u.name}</div>
            <div className="meta" style={{fontSize:10.5, marginTop:2}}>@{u.handle}</div>
            <div style={{fontSize:12, color:'var(--ink-mute)', marginTop:4}}>{u.bio}</div>
          </div>
          {opts.unfollow && (
            <button className="btn sm ghost" style={{flexShrink:0}} onClick={() => onToggleFollow(u.handle)}>언팔로우</button>
          )}
        </div>
      ))}
    </div>
  );

  const tabContent = {
    '글':    myPosts.length
              ? renderPosts(myPosts, { mine: isOwnProfile })
              : isOwnProfile
                ? (
                  <div style={{padding:'56px 0', textAlign:'center'}}>
                    <div style={{fontFamily:'var(--f-kr-serif)', fontSize:20, fontWeight:700, color:'var(--ink)', marginBottom:8}}>아직 쓴 글이 없어요</div>
                    <div className="meta" style={{fontSize:11.5, marginBottom:16}}>오늘의 키워드로 첫 글을 남겨보세요.</div>
                    <button className="btn sm solid" onClick={() => onNav('write')}>오늘의 글 쓰기 <span className="arr">→</span></button>
                  </div>
                )
                : (
                  <div style={{padding:'48px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:12}}>
                    아직 쓴 글이 없습니다.
                  </div>
                ),
    '저장':  savedPosts.length ? renderPosts(savedPosts) : renderPosts([]),
    '좋아요': likedPosts.length ? renderPosts(likedPosts) : renderPosts([]),
    '팔로잉': followingList.length || follows?.size
              ? renderUserList((followingList.length ? followingList : [...follows].map(h => {
                  const fromPost = posts.find(p => p.handle === h);
                  if (fromPost) return { name: fromPost.author, handle: h, avatarUrl: fromPost.avatarUrl, bio: '글로 만난 작가입니다.' };
                  return { name: `@${h}`, handle: h, avatarUrl: null, bio: '' };
                })).map(profileToUserListItem), { unfollow: true })
              : (
                <div style={{padding:'56px 0', textAlign:'center'}}>
                  <div style={{fontFamily:'var(--f-kr-serif)', fontSize:20, fontWeight:700, color:'var(--ink)', marginBottom:8}}>아직 팔로우한 작가가 없어요</div>
                  <div className="meta" style={{fontSize:11.5, marginBottom:16}}>둘러보기에서 마음에 드는 작가를 팔로우해보세요.</div>
                  <button className="btn sm solid" onClick={() => onNav('feed')}>둘러보기 <span className="arr">→</span></button>
                </div>
              ),
    '팔로워': followersList.length
              ? renderUserList(followersList.map(profileToUserListItem))
              : (
                <div style={{padding:'48px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:12}}>
                  아직 팔로워가 없습니다.
                </div>
              ),
    '차단':  blocks?.size
              ? (
                <div>
                  {[...blocks].map(h => {
                    const post = posts.find(p => p.handle === h);
                    const display = post ? { name: post.author, handle: h, avatarUrl: post.avatarUrl, bio: '차단된 작가입니다.' } : { name: `@${h}`, handle: h, avatarUrl: null, bio: '차단된 작가입니다.' };
                    return (
                      <div key={h} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:'1px solid var(--rule-ghost)'}}>
                        <div style={{display:'flex', gap:14, alignItems:'center'}}>
                          <Avatar url={display.avatarUrl} initial={display.name[0]} size={36} fontSize={14} />
                          <div>
                            <div style={{fontFamily:'var(--f-kr)', fontWeight:600, fontSize:14, color:'var(--ink)'}}>{display.name}</div>
                            <div className="meta" style={{fontSize:10.5, marginTop:2}}>@{h}</div>
                          </div>
                        </div>
                        <button className="btn sm" onClick={() => onBlockAuthor(h)}>차단 해제</button>
                      </div>
                    );
                  })}
                </div>
              )
              : (
                <div style={{padding:'48px 0', textAlign:'center', color:'var(--ink-mute)', fontFamily:'var(--f-mono)', fontSize:12}}>
                  차단한 작가가 없습니다.
                </div>
              ),
  };

  return (
    <div>
      <div className="wrap" style={{paddingTop:40}}>
        {/* Header */}
        <section style={{display:'grid', gridTemplateColumns:'1fr auto', gap:48, alignItems:'end', paddingBottom:28, borderBottom:'1px solid var(--rule)'}}>
          <div style={{display:'flex', gap:24, alignItems:'center'}}>
            {(() => {
              const profileAvatar = profileUser.avatarUrl;
              const resolved = resolveAssetUrl(profileAvatar);
              return resolved ? (
                <img src={resolved} alt={name} className="avatar"
                  style={{width:84, height:84, objectFit:'cover'}} />
              ) : (
                <div className="avatar" style={{width:84, height:84, fontSize:36, fontFamily:'var(--f-kr-serif)'}}>{initial}</div>
              );
            })()}
            <div>
              <div className="eyebrow" style={{marginBottom:8}}>{formatJoinDate(profileUser.createdAt)}</div>
              <h1 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:44, letterSpacing:'-0.02em', lineHeight:1, margin:0, color:'var(--ink)'}}>{name}</h1>
              <div style={{marginTop:8, display:'flex', gap:12, alignItems:'center', color:'var(--ink-mute)', fontSize:13}}>
                <span className="meta">@{handle}</span>
                <span style={{opacity:0.4}}>/</span>
                <span>{bio}</span>
              </div>
            </div>
          </div>
          <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
            <button className="btn sm ghost" onClick={handleShare}>공유</button>
            {isOwnProfile ? (
              <>
                <button className="btn sm" onClick={openEdit}>프로필 수정</button>
                <button className="btn sm" onClick={onLogout}>로그아웃</button>
                <button className="btn sm solid" onClick={() => onNav('write')}>새 글 쓰기 <span className="arr">→</span></button>
              </>
            ) : (
              <button className={`btn sm${followed ? ' ghost' : ' solid'}`} onClick={() => onToggleFollow(viewUser.handle)}>
                {followed ? '팔로잉 ✓' : '팔로우'}
              </button>
            )}
          </div>
        </section>

        {isOwnProfile && editing && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
            onClick={() => setEditing(false)}>
            <div style={{background:'var(--card)', border:'1px solid var(--rule-soft)', borderRadius:4, padding:32, maxWidth:440, width:'100%', boxShadow:'0 16px 48px rgba(0,0,0,0.12)'}}
              onClick={e => e.stopPropagation()}>
              <div className="eyebrow" style={{marginBottom:8}}>EDIT PROFILE · 프로필 수정</div>
              <h3 style={{fontFamily:'var(--f-kr-serif)', fontWeight:700, fontSize:24, letterSpacing:'-0.02em', margin:'0 0 20px', color:'var(--ink)'}}>
                내 프로필을 다듬어보세요
              </h3>

              <input ref={avatarFileRef} type="file" accept="image/*" onChange={handlePickAvatar} style={{display:'none'}} />
              <div style={{display:'flex', gap:14, alignItems:'center', marginBottom:22, paddingBottom:18, borderBottom:'1px solid var(--rule-ghost)'}}>
                {editAvatarUrl ? (
                  <img src={resolveAssetUrl(editAvatarUrl)} alt="" className="avatar" style={{width:64, height:64, objectFit:'cover'}} />
                ) : (
                  <div className="avatar" style={{width:64, height:64, fontSize:26, fontFamily:'var(--f-kr-serif)'}}>{(editNick.trim() || name)[0]}</div>
                )}
                <div style={{display:'flex', flexDirection:'column', gap:6, flex:1}}>
                  <div className="label" style={{fontSize:10}}>프로필 사진</div>
                  <div style={{display:'flex', gap:8}}>
                    <button type="button" className="btn sm" onClick={() => avatarFileRef.current?.click()} disabled={avatarUploading}>
                      {avatarUploading ? '업로드 중…' : (editAvatarUrl ? '변경' : '사진 추가')}
                    </button>
                    {editAvatarUrl && (
                      <button type="button" className="btn sm ghost" style={{color:'var(--accent)'}}
                        onClick={() => setEditAvatarUrl('')} disabled={avatarUploading}>제거</button>
                    )}
                  </div>
                  <div className="meta" style={{fontSize:10, color:'var(--ink-mute)'}}>JPG/PNG/WebP · 5MB 이하</div>
                </div>
              </div>

              <div style={{marginBottom:18}}>
                <div className="label" style={{fontSize:10, marginBottom:6}}>01 · 닉네임</div>
                <input className="field" value={editNick} onChange={e => setEditNick(e.target.value)} maxLength={20} autoFocus />
                <div style={{display:'flex', justifyContent:'space-between', marginTop:4, gap:8, fontFamily:'var(--f-mono)', fontSize:10}}>
                  <span style={{
                    color: editNickStatus === 'taken' ? '#c0392b'
                         : editNickStatus === 'ok' && editHandlePreview && editHandlePreview !== user?.handle ? 'var(--accent)'
                         : 'var(--ink-mute)',
                  }}>
                    {editNickStatus === 'checking' ? '닉네임 확인 중…'
                     : editNickStatus === 'taken'  ? '이미 사용 중인 닉네임입니다.'
                     : editHandlePreview && editHandlePreview === user?.handle ? '현재 사용 중인 닉네임'
                     : editNickStatus === 'ok' && editHandlePreview ? `사용 가능 · @${editHandlePreview}`
                     : ''}
                  </span>
                  <span className="meta" style={{fontSize:10}}>{editNick.length} / 20</span>
                </div>
              </div>

              <div style={{marginBottom:24}}>
                <div className="label" style={{fontSize:10, marginBottom:6}}>02 · 한 줄 소개</div>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  maxLength={80}
                  rows={2}
                  placeholder="당신을 한 줄로 소개해보세요"
                  style={{
                    width:'100%', resize:'none', border:'none',
                    borderBottom:'1px solid var(--rule-soft)', outline:'none',
                    background:'transparent', fontFamily:'var(--f-kr)', fontSize:15,
                    color:'var(--ink)', padding:'8px 0', lineHeight:1.6,
                  }}
                />
                <div className="meta" style={{fontSize:10, marginTop:4, textAlign:'right'}}>{editBio.length} / 80</div>
              </div>

              <div style={{display:'flex', gap:10, justifyContent:'space-between', alignItems:'center'}}>
                <span className="meta" style={{fontSize:10}}>⌘+Enter · 저장 · Esc · 취소</span>
                <span style={{display:'flex', gap:10}}>
                  <button className="btn ghost" onClick={() => setEditing(false)}>취소</button>
                  <button className="btn solid" onClick={saveEdit} title="⌘+Enter">저장 <span className="arr">→</span></button>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <section style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:40, padding:'28px 0', borderBottom:'1px solid var(--rule-soft)'}}>
          {statsRows.map(([k,v,s]) => (
            <div key={k}>
              <div className="label" style={{fontSize:10, marginBottom:8}}>{k}</div>
              <div style={{fontFamily:'var(--f-latin)', fontWeight:700, fontSize:34, letterSpacing:'-0.04em', color:'var(--ink)', fontVariantNumeric:'tabular-nums', lineHeight:1}}>
                {v} <span style={{fontSize:13, color:'var(--ink-mute)', fontFamily:'var(--f-kr)', fontWeight:500, letterSpacing:0, marginLeft:4}}>{s}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Streak — own profile only */}
        {isOwnProfile && (
          <section style={{padding:'28px 0', borderBottom:'1px solid var(--rule-soft)'}}>
            <div className="profile-streak-head" style={{display:'flex', justifyContent:'space-between', marginBottom:16, alignItems:'baseline'}}>
              <div>
                <div className="eyebrow">연속 작성 · WRITING STREAK</div>
                <div style={{fontFamily:'var(--f-kr-serif)', fontSize:22, fontWeight:700, marginTop:4, color:'var(--ink)'}}>
                  {formatNumber(profileStats.streak?.current)}일 연속 기록 중
                  {profileStats.streak?.completedToday && (
                    <span style={{color:'var(--accent)', fontFamily:'var(--f-latin)', fontSize:18, marginLeft:8}}>● 오늘 완료</span>
                  )}
                </div>
              </div>
              <div className="profile-streak-chips" style={{display:'flex', gap:10}}>
                {['30일','90일','1년'].map(p => (
                  <button key={p} className={`chip${streakPeriod===p?' active':''}`} onClick={() => setStreakPeriod(p)}>{p}</button>
                ))}
              </div>
            </div>
            <div className="streak" style={{overflowX:'auto'}}>
              {(streakData.length ? streakData : Array.from({ length: Number(streakKey) }, () => 'off')).map((s, i) => (
                <div key={i} className={`b ${s}`} style={{height: s==='off'?12 : s==='on'?30+((i*7)%40) : 74, flexShrink:0}} />
              ))}
            </div>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:8, fontFamily:'var(--f-mono)', fontSize:10, color:'var(--ink-mute)'}}>
              {(streakLabels.length ? streakLabels : ['','','','','','','오늘']).map((l, i) => <span key={`${l}-${i}`}>{l}</span>)}
            </div>
          </section>
        )}

        {/* Posts tabs */}
        <section style={{padding:'28px 0'}}>
          <div style={{display:'flex', gap:20, marginBottom:20, borderBottom:'1px solid var(--rule-ghost)'}}>
            {(isOwnProfile
              ? [['글',myPosts.length],['저장',savedPosts.length],['좋아요',likedPosts.length],['팔로잉',profileStats.following || followingList.length || follows?.size || 0],['팔로워',profileStats.followers || followersList.length],['차단', blocks?.size || 0]]
              : [['글', myPosts.length]]
            ).map(([k,n]) => (
              <button key={k} onClick={() => setProfileTab(k)} style={{
                background:'none', border:'none', padding:'10px 2px',
                borderBottom: profileTab===k ? '1.5px solid var(--ink)' : '1.5px solid transparent',
                color: profileTab===k ? 'var(--ink)' : 'var(--ink-mute)',
                fontFamily:'var(--f-kr)', fontWeight: profileTab===k ? 600 : 500, fontSize:13,
                letterSpacing:'-0.005em', cursor:'pointer'
              }}>
                {k} <span style={{fontFamily:'var(--f-latin)', color:'var(--ink-faint)', marginLeft:4}}>{n}</span>
              </button>
            ))}
          </div>
          {tabContent[profileTab]}
        </section>
      </div>
    </div>
  );
};
