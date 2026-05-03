const isLocalHost =
  typeof window === 'undefined' ||
  ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

const DEFAULT_API_BASE_URL = isLocalHost
  ? 'http://127.0.0.1:4000/api'
  : 'https://writehabit-api.onrender.com/api';

const API_BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error || '요청을 처리하지 못했습니다.', response.status);
  }

  return data;
};

export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

export const resolveAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return url;
};

export const uploadAvatar = async ({ file, token }) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/uploads/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || '이미지 업로드에 실패했습니다.', response.status);
  }
  return data;
};

export const register = ({ email, password, handle, displayName }) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, handle, displayName }),
  });

export const login = ({ email, password }) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const loginWithApple = ({ idToken, name }) =>
  request('/auth/apple', {
    method: 'POST',
    body: JSON.stringify({ idToken, name }),
  });

export const loginWithGoogle = ({ idToken, name }) =>
  request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken, name }),
  });

export const requestPasswordReset = ({ email }) =>
  request('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const confirmPasswordReset = ({ token, password }) =>
  request('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });

export const getMe = (token) =>
  request('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const checkHandleAvailability = (handle) =>
  request(`/auth/handles/${encodeURIComponent(handle)}`);

export const getStats = () => request('/stats');

export const listPosts = (token, { keywordId, keyword, q } = {}) => {
  const params = new URLSearchParams();
  if (keywordId) params.set('keywordId', keywordId);
  if (!keywordId && keyword) params.set('keyword', keyword);
  if (q) params.set('q', q);
  const qs = params.toString();
  return request(`/posts${qs ? `?${qs}` : ''}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });
};

export const createPost = ({ title, body, bodyHtml, keywordId, status, token }) =>
  request('/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, body, bodyHtml, keywordId, status }),
  });

export const updatePost = ({ id, title, body, bodyHtml, keywordId, status, token }) =>
  request(`/posts/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, body, bodyHtml, keywordId, status }),
  });

export const deletePost = ({ id, token }) =>
  request(`/posts/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const listDrafts = (token) =>
  request('/posts/drafts', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const createDraft = ({ title, body, bodyHtml, keywordId, token }) =>
  request('/posts/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, body, bodyHtml, keywordId }),
  });

export const updateDraft = ({ id, title, body, bodyHtml, keywordId, token }) =>
  request(`/posts/drafts/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, body, bodyHtml, keywordId }),
  });

export const publishDraft = ({ id, title, body, bodyHtml, keywordId, token }) =>
  request(`/posts/drafts/${id}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, body, bodyHtml, keywordId }),
  });

export const deleteDraft = ({ id, token }) =>
  request(`/posts/drafts/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const likePost = ({ id, token }) =>
  request(`/posts/${id}/like`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const unlikePost = ({ id, token }) =>
  request(`/posts/${id}/like`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const bookmarkPost = ({ id, token }) =>
  request(`/posts/${id}/bookmark`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const unbookmarkPost = ({ id, token }) =>
  request(`/posts/${id}/bookmark`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const listComments = ({ postId, token }) =>
  request(`/posts/${postId}/comments`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

export const createComment = ({ postId, body, token }) =>
  request(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });

export const deleteComment = ({ postId, commentId, token }) =>
  request(`/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getMyProfile = (token) =>
  request('/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const updateMyProfile = ({ displayName, handle, bio, avatarUrl, token }) =>
  request('/users/me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName, handle, bio, avatarUrl }),
  });

export const deleteMyAccount = (token) =>
  request('/users/me', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getPublicProfile = (handle) => request(`/users/${encodeURIComponent(handle)}`);

export const getTodayKeyword = () => request('/keywords/today');

export const listKeywordArchive = () => request('/keywords/archive');

export const listUpcomingKeywords = () => request('/keywords/upcoming');

export const createKeywordSuggestion = ({ word, eng, note, token }) =>
  request('/keywords/suggestions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ word, eng, note }),
  });

export const getMyStreak = ({ year, month, token }) => {
  const params = new URLSearchParams();
  if (year) params.set('year', year);
  if (month) params.set('month', month);
  const query = params.toString();
  return request(`/streaks/me${query ? `?${query}` : ''}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getMyStreakSummary = (token) =>
  request('/streaks/me/summary', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const getMySocialState = (token) =>
  request('/social/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const followUser = ({ handle, token }) =>
  request(`/users/${encodeURIComponent(handle)}/follow`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const unfollowUser = ({ handle, token }) =>
  request(`/users/${encodeURIComponent(handle)}/follow`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const blockUser = ({ handle, token }) =>
  request(`/users/${encodeURIComponent(handle)}/block`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const unblockUser = ({ handle, token }) =>
  request(`/users/${encodeURIComponent(handle)}/block`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const createReport = ({ targetType, targetId, reason, detail, token }) =>
  request('/reports', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ targetType, targetId, reason, detail }),
  });

export const listNotifications = (token) =>
  request('/notifications', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const markNotificationRead = ({ id, token }) =>
  request(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const markAllNotificationsRead = (token) =>
  request('/notifications/read-all', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const listAdminKeywordSchedule = (token) =>
  request('/admin/keywords/schedule', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const listAdminKeywordRecommendations = ({ count = 7, token }) =>
  request(`/admin/keywords/recommendations?count=${encodeURIComponent(count)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const listAdminKeywordSuggestions = (token) =>
  request('/admin/keywords/suggestions', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const updateAdminKeywordSuggestion = ({ id, status, token }) =>
  request(`/admin/keywords/suggestions/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

export const createAdminKeywordSchedule = ({ date, word, eng, prompt, status, token }) =>
  request('/admin/keywords/schedule', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date, word, eng, prompt, status }),
  });

export const updateAdminKeywordSchedule = ({ id, date, word, eng, prompt, status, token }) =>
  request(`/admin/keywords/schedule/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date, word, eng, prompt, status }),
  });

export const listAdminReports = (token) =>
  request('/admin/reports', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

export const updateAdminReport = ({ id, status, token }) =>
  request(`/admin/reports/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
