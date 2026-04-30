import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider, useToast } from './components/Toast.jsx';
import { Logo } from './components/Logo.jsx';
import { OnboardingOverlay } from './components/OnboardingOverlay.jsx';
import { TopBar } from './components/TopBar.jsx';
import { FeedScreen } from './screens/FeedScreen.jsx';
import { WriteScreen } from './screens/WriteScreen.jsx';
import { DetailScreen } from './screens/DetailScreen.jsx';
import { ProfileScreen } from './screens/ProfileScreen.jsx';
import { ArchiveScreen } from './screens/ArchiveScreen.jsx';
import { LoginScreen } from './screens/LoginScreen.jsx';
import { SettingsScreen } from './screens/SettingsScreen.jsx';
import { AdminScreen } from './screens/AdminScreen.jsx';
import { LegalScreen } from './screens/LegalScreen.jsx';
import { blockUser, bookmarkPost, createDraft, createPost, createReport, deleteDraft, deleteMyAccount, deletePost, followUser, getMe, getMySocialState, getStats, getTodayKeyword, likePost, listDrafts, listKeywordArchive, listNotifications, listPosts, markAllNotificationsRead, markNotificationRead, publishDraft, unblockUser, unbookmarkPost, unfollowUser, unlikePost, updateDraft, updateMyProfile, updatePost } from './lib/api.js';
import { sanitizeHandle } from './lib/handles.js';
import { CONTACT_MAILTO } from './lib/contact.js';
import { readJSON, readReports, readSet, readString, removeStorageKeys, writeJSON, writeReports, writeSet, writeString } from './lib/storage.js';
import { ACCOUNT_STORAGE_KEYS, DEFAULT_PREFS, KEYWORDS_ARCHIVE, TODAY_KW } from './data/writehabitData.js';
import './styles.css';

const MobileBottomNav = ({ active, onNav }) => {
  const items = [
    ['write', '✎', 'WRITE'],
    ['archive', '▤', 'ARCHIVE'],
    ['feed', '☷', 'BROWSE'],
    ['profile', '◉', 'PROFILE'],
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
      {items.map(([key, icon, label]) => (
        <button
          key={key}
          className={active === key ? 'active' : ''}
          onClick={() => onNav(key)}
          type="button"
        >
          <span className="mobile-bottom-nav-icon">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
};

/* ══════════════════════════════
   APP ROOT
══════════════════════════════ */
const App = () => {
  const toast = useToast();

  const [screen, setScreen]   = useState(() => readString('wh_auth_token') || readString('wh_logged_in') ? 'feed' : 'login');
  const [dark, setDark]       = useState(() => readString('wh_dark') === '1');
  const [posts, setPosts]     = useState([]);
  const [activePost, setPost]         = useState(null);
  const [activeProfile, setProfile]   = useState(null); // null = own profile, or {handle,author,initial,bio}
  const [editingDraft, setEditingDraft] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [todayKw, setTodayKw] = useState(TODAY_KW);
  const [keywordArchive, setKeywordArchive] = useState(KEYWORDS_ARCHIVE);
  const [stats, setStats] = useState({
    serviceDays: Number(TODAY_KW.no) || 1,
    users: 0,
    posts: 0,
    todayPosts: 0,
  });
  const [feedKeyword, setFeedKeyword] = useState(null);
  const [user, setUser]       = useState(() => {
    const saved = readString('wh_auth_token') || readString('wh_logged_in');
    if (!saved) return null;
    const profile = readJSON('wh_profile', {});
    return {
      nickname: profile.nickname || '사용자',
      email:    profile.email    || '',
      bio:      profile.bio      || '',
    };
  });

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    writeString('wh_dark', dark ? '1' : '0');
  }, [dark]);

  /* ── Font preset ── */
  const [fontPreset, setFontPreset] = useState(() => readString('wh_font', '2'));
  useEffect(() => {
    ['font-1','font-2','font-3','font-4'].forEach(c => document.body.classList.remove(c));
    document.body.classList.add(`font-${fontPreset}`);
    writeString('wh_font', fontPreset);
  }, [fontPreset]);

  useEffect(() => {
    if (user) {
      writeJSON('wh_profile', user);
    }
  }, [user]);

  const mergeRemotePosts = (remotePosts) => {
    if (!Array.isArray(remotePosts)) return;
    setPosts(remotePosts);
  };

  const refreshPosts = async (keyword = null, q = '') => {
    const token = readString('wh_auth_token');
    const keywordId = keyword?.id || keyword?.keywordId || null;
    const keywordWord = keyword?.word || null;
    const params = keywordId ? { keywordId } : keywordWord ? { keyword: keywordWord } : {};
    if (q) params.q = q;
    const { posts: remotePosts } = await listPosts(token, params);
    mergeRemotePosts(remotePosts);
  };

  const onSearchPosts = (q) => {
    refreshPosts(feedKeyword, q).catch(() => {});
  };

  const getLocalDraft = () => {
    const draft = readJSON('wh_draft', null);
    if (!draft || (!draft.title && !draft.bodyHTML)) return null;
    const body = (draft.bodyHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { ...draft, body };
  };

  const refreshDrafts = async () => {
    const token = readString('wh_auth_token');
    if (!token) return;
    const { drafts: remoteDrafts } = await listDrafts(token);
    setDrafts(remoteDrafts || []);
  };

  useEffect(() => {
    getTodayKeyword()
      .then(({ keyword }) => {
        if (keyword?.word) setTodayKw(keyword);
      })
      .catch(() => {});
    getStats()
      .then(({ stats: remoteStats }) => {
        if (remoteStats) setStats(remoteStats);
      })
      .catch(() => {});
    listKeywordArchive()
      .then(({ keywords }) => {
        if (Array.isArray(keywords) && keywords.length) setKeywordArchive(keywords);
      })
      .catch(() => {});

    const token = readString('wh_auth_token');
    refreshPosts()
      .catch(() => {});
    if (token) refreshDrafts().catch(() => {});
    if (token) {
      getMySocialState(token)
        .then(({ following, blocks }) => {
          setFollows(new Set(following || []));
          setBlocks(new Set(blocks || []));
        })
        .catch(() => {});
    }

    if (!token) return;

    getMe(token)
      .then(({ user: remoteUser }) => {
        setUser({
          id: remoteUser.id,
          nickname: remoteUser.displayName,
          handle: remoteUser.handle,
          email: remoteUser.email,
          bio: remoteUser.bio || '',
          role: remoteUser.role,
          avatarUrl: remoteUser.avatarUrl,
        });
      })
      .catch((error) => {
        if (error.status === 401) {
          removeStorageKeys(['wh_auth_token', 'wh_logged_in']);
          setUser(null);
          setScreen('login');
        }
      });
  }, []);

  const onUpdateUser = async (patch) => {
    const token = readString('wh_auth_token');
    if (token) {
      try {
        const { user: remoteUser } = await updateMyProfile({
          displayName: patch.nickname,
          handle: patch.handle,
          bio: patch.bio,
          avatarUrl: patch.avatarUrl,
          token,
        });
        const nextUser = toAppUser(remoteUser);
        setUser(nextUser);
        return nextUser;
      } catch (error) {
        if (error.status !== 503) {
          toast(error.message || '프로필 수정에 실패했습니다.', 'error');
          throw error;
        }
        toast('DB가 아직 준비되지 않아 로컬에서만 프로필을 수정했습니다.', 'info');
      }
    }

    let nextUser;
    setUser(u => {
      nextUser = { ...u, ...patch };
      return nextUser;
    });
    return nextUser;
  };

  /* ── Onboarding ── shown to first-time users after signup */
  const [onboarded, setOnboarded] = useState(() => readString('wh_onboarded') === '1');
  const onCompleteOnboarding = () => {
    writeString('wh_onboarded', '1');
    setOnboarded(true);
  };
  const onSkipOnboarding = onCompleteOnboarding;

  /* ── Notification preferences ── */
  const [prefs, setPrefs] = useState(() => {
    return { ...DEFAULT_PREFS, ...readJSON('wh_prefs', {}) };
  });
  useEffect(() => { writeJSON('wh_prefs', prefs); }, [prefs]);
  const onUpdatePrefs = (patch) => setPrefs(p => ({...p, ...patch}));

  const clearLocalAccountState = () => {
    removeStorageKeys(ACCOUNT_STORAGE_KEYS);
    setUser(null);
    setPosts([]);
    setBlocks(new Set());
    setFollows(new Set());
    setNotifications([]);
    setEditingPost(null);
    setEditingDraft(null);
    setDrafts([]);
    setOnboarded(false);
    setScreen('login');
  };

  const onDeleteAccount = async () => {
    const token = readString('wh_auth_token');
    if (token) {
      try {
        await deleteMyAccount(token);
      } catch (error) {
        toast(error.message || '계정 삭제에 실패했습니다.', 'error');
        throw error;
      }
    }
    clearLocalAccountState();
    toast('계정이 삭제되었습니다.');
  };

  const onExportData = () => {
    const data = {
      profile: user,
      posts: posts.filter(p => p.handle === user?.handle || p.author === user?.nickname),
      comments: readJSON('wh_comments', {}),
      follows: [...follows],
      blocks: [...blocks],
      prefs,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `writehabit-${user?.handle || 'data'}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('데이터가 다운로드되었습니다.');
  };

  /* ── Notifications ── */
  const [notifications, setNotifications] = useState(() => {
    const saved = readJSON('wh_notifications', null);
    if (saved) return saved;
    return [];
  });
  useEffect(() => {
    writeJSON('wh_notifications', notifications);
  }, [notifications]);
  const refreshNotifications = async () => {
    const token = readString('wh_auth_token');
    if (!token) return;
    const { notifications: remoteNotifications } = await listNotifications(token);
    setNotifications(remoteNotifications || []);
  };
  useEffect(() => {
    refreshNotifications().catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => refreshNotifications().catch(() => {}), 30_000);
    return () => clearInterval(id);
  }, [user]);
  const onMarkAllRead = async () => {
    const token = readString('wh_auth_token');
    setNotifications(ns => ns.map(n => ({...n, read:true})));
    if (token) {
      try {
        await markAllNotificationsRead(token);
      } catch {}
    }
  };
  const onMarkRead = async (id) => {
    const token = readString('wh_auth_token');
    setNotifications(ns => ns.map(n => n.id === id ? {...n, read:true} : n));
    if (token) {
      try {
        await markNotificationRead({ id, token });
      } catch {}
    }
  };
  const onClearNotifications = () => {
    if (!window.confirm('모든 알림을 삭제할까요?')) return;
    setNotifications([]);
  };
  const onNotificationClick = (n) => {
    onMarkRead(n.id);
    if (n.target?.type === 'post') {
      const targetPost = posts.find((post) =>
        (n.target.id && post.id === n.target.id) ||
        (n.target.title && post.title === n.target.title)
      );
      if (targetPost) {
        onNav('detail', targetPost);
      } else {
        toast('연결된 글을 찾을 수 없습니다.', 'info');
      }
      return;
    }

    if (n.type === 'follow' && n.actor?.handle) {
      onNav('profile', {
        handle: n.actor.handle,
        author: n.actor.name,
        initial: n.actor.initial || n.actor.name?.[0] || '?',
      });
      return;
    }

    if (n.action?.screen) {
      onNav(n.action.screen, n.action.data);
      return;
    }
  };

  const requireAuth = (message = '로그인이 필요한 기능입니다.') => {
    if (user) return true;
    toast(message);
    setScreen('login');
    return false;
  };

  /* ── Blocks ── */
  const [blocks, setBlocks] = useState(() => readSet('wh_blocks'));
  const onBlockAuthor = async (handle) => {
    if (!requireAuth('차단하려면 로그인이 필요합니다.')) return;
    const token = readString('wh_auth_token');
    const isBlocked = blocks.has(handle);

    if (token) {
      try {
        await (isBlocked ? unblockUser({ handle, token }) : blockUser({ handle, token }));
      } catch (error) {
        if (error.status !== 503) {
          toast(error.message || '차단 처리에 실패했습니다.', 'error');
          return;
        }
      }
    }

    setBlocks(prev => {
      const next = new Set(prev);
      if (next.has(handle)) { next.delete(handle); toast('차단을 해제했습니다.'); }
      else                  { next.add(handle);    toast('이 작가의 글과 댓글이 더 이상 표시되지 않습니다.'); }
      writeSet('wh_blocks', next);
      return next;
    });
  };
  const [follows, setFollows] = useState(() => readSet('wh_follows'));

  const onToggleFollow = async (handle) => {
    if (!requireAuth('팔로우하려면 로그인이 필요합니다.')) return;
    const token = readString('wh_auth_token');
    const isFollowing = follows.has(handle);

    if (token) {
      try {
        await (isFollowing ? unfollowUser({ handle, token }) : followUser({ handle, token }));
      } catch (error) {
        if (error.status !== 503) {
          toast(error.message || '팔로우 처리에 실패했습니다.', 'error');
          return;
        }
      }
    }

    setFollows(prev => {
      const next = new Set(prev);
      if (next.has(handle)) { next.delete(handle); toast('팔로우를 취소했습니다.'); }
      else                  { next.add(handle);    toast('작가를 팔로우합니다.'); }
      writeSet('wh_follows', next);
      return next;
    });
  };
  const onReport = async ({ targetType, targetId, targetHandle, reason, detail }) => {
    if (!requireAuth('신고하려면 로그인이 필요합니다.')) return;
    const token = readString('wh_auth_token');
    if (token && typeof targetId === 'string') {
      try {
        await createReport({ targetType, targetId, reason, detail, token });
        toast('신고가 접수되었습니다. 운영진이 24시간 내 확인합니다.');
        return;
      } catch (error) {
        if (error.status !== 503) {
          toast(error.message || '신고 접수에 실패했습니다.', 'error');
          return;
        }
      }
    }

    const reports = readReports();
    reports.unshift({
      id: Date.now(), targetType, targetId, targetHandle, reason, detail: detail || '',
      reporter: user?.handle || 'anonymous', at: new Date().toISOString(),
    });
    writeReports(reports);
    toast('신고가 접수되었습니다. 운영진이 24시간 내 확인합니다.');
  };

  useEffect(() => {
    writeJSON('wh_posts', posts);
  }, [posts]);

  const isPoppingRef = useRef(false);

  useEffect(() => {
    history.replaceState({ screen, postId: activePost?.id ?? null }, '');
    const onPop = (e) => {
      isPoppingRef.current = true;
      const s = e.state?.screen || (readString('wh_auth_token') || readString('wh_logged_in') ? 'feed' : 'login');
      const pid = e.state?.postId ?? null;
      setScreen(s);
      if (s === 'detail' && pid != null) {
        const found = posts.find(p => p.id === pid);
        if (found) setPost(found);
      }
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      setTimeout(() => { isPoppingRef.current = false; }, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [posts, activePost, screen]);

  const onNav = (target, data) => {
    if (!user && ['write', 'profile', 'settings', 'admin'].includes(target)) {
      toast('로그인 후 사용할 수 있습니다.');
      setScreen('login');
      return;
    }
    setScreen(target);
    if (target === 'feed') {
      const nextKeyword = data?.keyword || null;
      setFeedKeyword(nextKeyword);
      refreshPosts(nextKeyword).catch(() => {});
    }
    if (target === 'detail' && data) setPost(data);
    if (target === 'profile') {
      const myHandle = user?.handle || sanitizeHandle(user?.nickname || '');
      setProfile(data && data.handle !== myHandle ? data : null);
    }
    if (!isPoppingRef.current) {
      history.pushState({ screen: target, postId: target === 'detail' ? data?.id ?? null : null }, '');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onToggleDark = () => setDark(d => !d);

  const applyPostPatch = (id, updater) => {
    setPosts(ps => ps.map(p => p.id === id
      ? (typeof updater === 'function' ? updater(p) : { ...p, ...updater })
      : p
    ));
    setPost(prev => prev?.id === id
      ? (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater })
      : prev
    );
  };

  const onToggleLike = async (id) => {
    if (!requireAuth('좋아요를 누르려면 로그인이 필요합니다.')) return;
    const current = posts.find(p => p.id === id) || activePost;
    const nextLiked = !current?.liked;
    const token = readString('wh_auth_token');

    if (!token || typeof id !== 'string') {
      toast('서버에 연결된 로그인 상태에서만 처리할 수 있습니다.', 'error');
      throw new Error('Authentication required');
    }

    try {
      const { post } = nextLiked
        ? await likePost({ id, token })
        : await unlikePost({ id, token });
      applyPostPatch(id, post);
      return post;
    } catch (error) {
      toast(error.message || '좋아요 처리에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
      throw error;
    }
  };

  const onToggleBookmark = async (id) => {
    if (!requireAuth('저장하려면 로그인이 필요합니다.')) return;
    const current = posts.find(p => p.id === id) || activePost;
    const nextBookmarked = !current?.bookmarked;
    const token = readString('wh_auth_token');

    if (!token || typeof id !== 'string') {
      toast('서버에 연결된 로그인 상태에서만 처리할 수 있습니다.', 'error');
      throw new Error('Authentication required');
    }

    try {
      const { post } = nextBookmarked
        ? await bookmarkPost({ id, token })
        : await unbookmarkPost({ id, token });
      applyPostPatch(id, post);
      return post;
    } catch (error) {
      toast(error.message || '저장 처리에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
      throw error;
    }
  };

  const onPublish = async ({ title, body, bodyHtml, draftId, keywordId }) => {
    const token = readString('wh_auth_token');
    const activeKeywordId = keywordId || todayKw?.id || null;
    if (!token) {
      toast('글을 발행하려면 다시 로그인해주세요.', 'error');
      throw new Error('Authentication required');
    }

    try {
      const { post } = draftId
        ? await publishDraft({ id: draftId, title, body, bodyHtml, keywordId: activeKeywordId, token })
        : await createPost({ title, body, bodyHtml, keywordId: activeKeywordId, token });
      setPosts(ps => [post, ...ps.filter(p => p.id !== post.id)]);
      if (draftId) setDrafts(prev => prev.filter(d => d.id !== draftId));
      return post;
    } catch (error) {
      toast(error.message || '글 발행에 실패했습니다. 서버 연결을 확인한 뒤 다시 시도해주세요.', 'error');
      throw error;
    }
  };

  const onSaveDraft = async ({ id, title, body, bodyHTML, keywordId }) => {
    const token = readString('wh_auth_token');
    if (!token) return null;
    const activeKeywordId = keywordId || todayKw?.id || null;

    try {
      const response = id
        ? await updateDraft({ id, title, body, bodyHtml: bodyHTML, keywordId: activeKeywordId, token })
        : await createDraft({ title, body, bodyHtml: bodyHTML, keywordId: activeKeywordId, token });
      const saved = response.draft;
      setDrafts(prev => [saved, ...prev.filter(d => d.id !== saved.id)]);
      return saved;
    } catch (error) {
      if (error.status !== 503) throw error;
      return null;
    }
  };

  const [editingPost, setEditingPost] = useState(null);

  const onUpdatePost = async (id, { title, body, bodyHtml }) => {
    const token = readString('wh_auth_token');
    if (!token || typeof id !== 'string') {
      toast('글을 수정하려면 다시 로그인해주세요.', 'error');
      throw new Error('Authentication required');
    }

    try {
      const { post } = await updatePost({ id, title, body, bodyHtml, token });
      setPosts(ps => ps.map(p => p.id === id ? post : p));
      setPost(prev => prev?.id === id ? post : prev);
      return post;
    } catch (error) {
      toast(error.message || '글 수정에 실패했습니다. 서버 연결을 확인한 뒤 다시 시도해주세요.', 'error');
      throw error;
    }
  };

  const onDeletePost = async (id) => {
    const token = readString('wh_auth_token');
    if (!token || typeof id !== 'string') {
      toast('글을 삭제하려면 다시 로그인해주세요.', 'error');
      throw new Error('Authentication required');
    }

    try {
      await deletePost({ id, token });
      setPosts(ps => ps.filter(p => p.id !== id));
      /* clear comments tied to this post */
      try {
        const all = readJSON('wh_comments', {});
        delete all[id];
        writeJSON('wh_comments', all);
      } catch {}
    } catch (error) {
      toast(error.message || '글 삭제에 실패했습니다. 서버 연결을 확인한 뒤 다시 시도해주세요.', 'error');
      throw error;
    }
  };

  const onEditPost = (post) => {
    setEditingPost(post);
    setEditingDraft(null);
    onNav('write');
  };

  const onEditDraft = (draft) => {
    setEditingPost(null);
    setEditingDraft(draft);
    onNav('write');
  };

  const onDeleteDraft = async (draft) => {
    if (!window.confirm(`"${draft.title || '제목 없는 초안'}" 을(를) 삭제할까요?`)) return;
    if (draft.source === 'local') {
      localStorage.removeItem('wh_draft');
      setEditingDraft(null);
      setDrafts(prev => [...prev]);
      toast('임시저장글이 삭제되었습니다.');
      return;
    }

    const token = readString('wh_auth_token');
    if (!token) return;
    try {
      await deleteDraft({ id: draft.id, token });
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      toast('임시저장글이 삭제되었습니다.');
    } catch (error) {
      toast(error.message || '임시저장글 삭제에 실패했습니다.', 'error');
    }
  };

  const toAppUser = (remoteUser) => ({
    id: remoteUser.id,
    nickname: remoteUser.displayName,
    handle: remoteUser.handle,
    email: remoteUser.email,
    bio: remoteUser.bio || '',
    role: remoteUser.role,
    avatarUrl: remoteUser.avatarUrl,
  });

  const onLogin = ({ user: remoteUser, accessToken }, remember = true) => {
    const userData = toAppUser(remoteUser);
    if (remember) {
      writeString('wh_auth_token', accessToken);
      writeString('wh_logged_in', '1');
    } else {
      removeStorageKeys(['wh_auth_token', 'wh_logged_in']);
    }
    setUser(userData);
    setScreen('feed');
    listNotifications(accessToken)
      .then(({ notifications: remoteNotifications }) => setNotifications(remoteNotifications || []))
      .catch(() => {});
    toast(`환영합니다, ${userData.nickname}님!`);
  };

  const onLogout = () => {
    removeStorageKeys(['wh_auth_token', 'wh_logged_in']);
    setUser(null);
    setScreen('login');
    toast('로그아웃되었습니다.');
  };

  if (screen === 'login') {
    return <LoginScreen onLogin={onLogin} onBrowse={() => onNav('feed')} onLegalNav={onNav} todayKw={todayKw} stats={stats} knownHandles={[]} />;
  }

  const commonProps = { onNav, dark, onToggleDark };

  const showMobileBottomNav = ['feed', 'archive', 'profile', 'detail'].includes(screen);

  return (
    <div className={showMobileBottomNav ? 'has-mobile-bottom-nav' : ''}>
      {!onboarded && user && (
        <OnboardingOverlay onDone={onCompleteOnboarding} onSkip={onSkipOnboarding} onNav={onNav} stats={stats} />
      )}
      {screen !== 'write' && screen !== 'admin' && (
        <TopBar active={screen} {...commonProps} user={user} onLogout={onLogout}
          todayKw={todayKw}
          notifications={notifications}
          onMarkAllRead={onMarkAllRead}
          onClearNotifications={onClearNotifications}
          onNotificationClick={onNotificationClick} />
      )}

      {screen === 'feed'    && <FeedScreen    {...commonProps} posts={posts.filter(p => !blocks.has(p.handle))}
                                  onToggleLike={onToggleLike} onToggleBookmark={onToggleBookmark}
                                  blocks={blocks} follows={follows} onToggleFollow={onToggleFollow}
                                  onReport={onReport} onBlockAuthor={onBlockAuthor} todayKw={todayKw}
                                  stats={stats}
                                  keywordFilter={feedKeyword} onSearch={onSearchPosts}
                                  onClearKeywordFilter={() => onNav('feed')} />}
      {screen === 'write'   && <WriteScreen   {...commonProps} onPublish={onPublish} onSaveDraft={onSaveDraft} user={user} todayKw={todayKw}
                                  editingPost={editingPost}
                                  editingDraft={editingDraft}
                                  drafts={drafts} localDraft={getLocalDraft()}
                                  onLoadDraft={onEditDraft} onDeleteDraft={onDeleteDraft}
                                  onUpdatePost={onUpdatePost}
                                  onClearEditing={() => setEditingPost(null)}
                                  onClearDraftEditing={() => setEditingDraft(null)} />}
      {screen === 'detail'  && <DetailScreen  {...commonProps} post={activePost} posts={posts}
                                  onToggleLike={onToggleLike} onToggleBookmark={onToggleBookmark}
                                  user={user} onEditPost={onEditPost} onDeletePost={onDeletePost}
                                  blocks={blocks} follows={follows} onToggleFollow={onToggleFollow}
                                  onReport={onReport} onBlockAuthor={onBlockAuthor} todayKw={todayKw} stats={stats} />}
      {screen === 'profile' && <ProfileScreen {...commonProps} posts={posts} user={user} onLogout={onLogout}
                                  viewUser={activeProfile}
                                  onUpdateUser={onUpdateUser}
                                  onEditPost={onEditPost} onDeletePost={onDeletePost}
                                  blocks={blocks} follows={follows} onToggleFollow={onToggleFollow}
                                  onBlockAuthor={onBlockAuthor} />}
      {screen === 'archive' && <ArchiveScreen {...commonProps} keywords={keywordArchive} stats={stats} todayKw={todayKw} />}
      {screen === 'admin'   && <AdminScreen   {...commonProps} user={user} onLogout={onLogout} />}
      {screen === 'settings' && <SettingsScreen {...commonProps} user={user} prefs={prefs}
                                  onUpdatePrefs={onUpdatePrefs} onLogout={onLogout}
                                  onExportData={onExportData} onDeleteAccount={onDeleteAccount} />}
      {screen === 'terms' && <LegalScreen {...commonProps} type="terms" />}
      {screen === 'privacy' && <LegalScreen {...commonProps} type="privacy" />}

      {showMobileBottomNav && <MobileBottomNav active={screen === 'detail' ? 'feed' : screen} onNav={onNav} />}

      <footer style={{borderTop:'1px solid var(--rule-ghost)', padding:'24px 56px', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:40}}>
        <div style={{display:'flex', gap:24, alignItems:'center'}}>
          <Logo onClick={() => onNav('feed')} small />
          <span className="meta" style={{fontSize:10}}>© 2026 WriteHabit</span>
        </div>
        <div style={{display:'flex', gap:20, fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-mute)'}}>
          <button onClick={() => onNav('terms')} style={{background:'none', border:'none', cursor:'pointer', fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-mute)', padding:0}}>이용약관</button>
          <button onClick={() => onNav('privacy')} style={{background:'none', border:'none', cursor:'pointer', fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-mute)', padding:0}}>개인정보처리방침</button>
          <a href={CONTACT_MAILTO} style={{fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-mute)', textDecoration:'none'}}>문의/피드백</a>
          {user?.role === 'ADMIN' && (
            <button onClick={() => onNav('admin')} style={{background:'none', border:'none', cursor:'pointer', fontFamily:'var(--f-mono)', fontSize:10.5, color:'var(--ink-faint)'}}>Admin ↗</button>
          )}
        </div>
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')).render(
  <ToastProvider><App /></ToastProvider>
);
