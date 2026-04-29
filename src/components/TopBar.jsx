import { useState } from 'react';
import { Avatar } from './Avatar.jsx';
import { IconMoon, IconSun } from './Icons.jsx';
import { Logo } from './Logo.jsx';

export const TopBar = ({
  active,
  onNav,
  dark,
  onToggleDark,
  right,
  user,
  onLogout,
  todayKw,
  notifications = [],
  onMarkAllRead,
  onClearNotifications,
  onNotificationClick,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const initial = user?.nickname?.[0] || '?';
  const unreadCount = notifications.filter((n) => !n.read).length;
  const handleNotifClick = (n) => {
    setNotifOpen(false);
    onNotificationClick?.(n);
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <Logo onClick={() => onNav('feed')} />
        <nav className="tabs">
          {[
            ['feed', '둘러보기'],
            ['write', '글쓰기'],
            ['archive', '아카이브'],
            ['profile', '프로필'],
          ].map(([k, label]) => (
            <button key={k} className={active === k ? 'active' : ''} onClick={() => onNav(k)}>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {right || (
          <>
            {todayKw && (
              <span className="meta" style={{ fontSize: 11 }}>
                {todayKw.dateStr.replace(/·/g, ' · ')} · {todayKw.weekday}
              </span>
            )}
            <button className="dark-toggle" onClick={onToggleDark} title="테마 전환">
              {dark ? <IconSun /> : <IconMoon />}
            </button>
            {user && (
            <div style={{ position: 'relative' }}>
              <button
                className="dark-toggle"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setMenuOpen(false);
                }}
                title="알림"
                style={{ position: 'relative' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                    }}
                  />
                )}
              </button>
              {notifOpen && (
                <div
                  className="notif-dropdown"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 10px)',
                    zIndex: 200,
                    width: 340,
                    maxWidth: '90vw',
                    maxHeight: 480,
                    overflow: 'auto',
                    background: 'var(--card)',
                    border: '1px solid var(--rule-soft)',
                    borderRadius: 4,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px 10px',
                      borderBottom: '1px solid var(--rule-ghost)',
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'var(--f-kr)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                        알림
                      </div>
                      {unreadCount > 0 && (
                        <div className="meta" style={{ fontSize: 10 }}>
                          안 읽은 알림 {unreadCount}
                        </div>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <span style={{ display: 'flex', gap: 6 }}>
                        {unreadCount > 0 && (
                          <button
                            onClick={onMarkAllRead}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontFamily: 'var(--f-mono)',
                              fontSize: 10.5,
                              color: 'var(--ink-mute)',
                            }}
                          >
                            모두 읽음
                          </button>
                        )}
                        <button
                          onClick={onClearNotifications}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--f-mono)',
                            fontSize: 10.5,
                            color: 'var(--accent)',
                          }}
                        >
                          비우기
                        </button>
                      </span>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div
                      style={{
                        padding: '40px 14px',
                        textAlign: 'center',
                        color: 'var(--ink-mute)',
                        fontFamily: 'var(--f-mono)',
                        fontSize: 11,
                      }}
                    >
                      아직 알림이 없습니다.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: '12px 14px',
                          borderBottom: '1px solid var(--rule-ghost)',
                          cursor: 'pointer',
                          background: n.read ? 'transparent' : 'var(--accent-soft)',
                        }}
                      >
                        {n.actor ? (
                          <Avatar url={n.actor.avatarUrl} initial={n.actor.initial} size={32} fontSize={13}
                            style={{ flexShrink: 0 }} />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--paper-2)',
                              color: 'var(--accent)',
                              fontSize: 14,
                            }}
                          >
                            ★
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                            {n.type === 'like' && (
                              <>
                                <strong style={{ color: 'var(--ink)' }}>{n.actor.name}</strong>님이{' '}
                                <span style={{ color: 'var(--ink-mute)' }}>{n.target?.title}</span>을(를) 좋아합니다.
                              </>
                            )}
                            {n.type === 'comment' && (
                              <>
                                <strong style={{ color: 'var(--ink)' }}>{n.actor.name}</strong>님이 댓글을 남겼습니다.
                              </>
                            )}
                            {n.type === 'follow' && (
                              <>
                                <strong style={{ color: 'var(--ink)' }}>{n.actor.name}</strong>님이 회원님을 팔로우합니다.
                              </>
                            )}
                            {n.type === 'mention' && (
                              <>
                                <strong style={{ color: 'var(--ink)' }}>{n.actor.name}</strong>님이 회원님을 언급했습니다.
                              </>
                            )}
                            {n.type === 'system' && n.text}
                          </div>
                          {n.preview && (
                            <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 4, fontStyle: 'italic' }}>
                              "{n.preview}"
                            </div>
                          )}
                          <div className="meta" style={{ fontSize: 10, marginTop: 4 }}>
                            {n.time}
                          </div>
                        </div>
                        {!n.read && (
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              flexShrink: 0,
                              alignSelf: 'center',
                            }}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            )}
            {user ? (
              <button className="btn sm solid" onClick={() => onNav('write')}>
                글쓰기 <span className="arr">→</span>
              </button>
            ) : (
              <button className="btn sm solid" onClick={() => onNav('login')}>
                로그인 <span className="arr">→</span>
              </button>
            )}
            {user && (
            <div style={{ position: 'relative' }}>
              <Avatar url={user?.avatarUrl} initial={initial} size={32} fontSize={13}
                style={{ cursor: 'pointer' }}
                onClick={() => setMenuOpen((o) => !o)} />
              {menuOpen && (
                <div
                  className="user-menu-dropdown"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 10px)',
                    background: 'var(--card)',
                    border: '1px solid var(--rule-soft)',
                    borderRadius: 4,
                    minWidth: 160,
                    zIndex: 200,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  }}
                  onClick={() => setMenuOpen(false)}
                >
                  <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--rule-ghost)' }}>
                    <div style={{ fontFamily: 'var(--f-kr)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                      {user?.nickname || '사용자'}
                    </div>
                    <div className="meta" style={{ fontSize: 10.5 }}>
                      {user?.email || ''}
                    </div>
                  </div>
                  <button onClick={() => onNav('profile')} style={menuButtonStyle}>
                    프로필 보기
                  </button>
                  <button onClick={() => onNav('settings')} style={menuButtonStyle}>
                    설정
                  </button>
                  <button
                    onClick={onLogout}
                    style={{
                      ...menuButtonStyle,
                      color: 'var(--accent)',
                      borderTop: '1px solid var(--rule-ghost)',
                    }}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};

const menuButtonStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '9px 14px',
  background: 'none',
  border: 'none',
  fontFamily: 'var(--f-kr)',
  fontSize: 13,
  color: 'var(--ink-soft)',
  cursor: 'pointer',
};
