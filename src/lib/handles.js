const RESERVED_HANDLES = new Set([
  'admin',
  'help',
  'support',
  'about',
  'login',
  'signup',
  'write',
  'feed',
  'archive',
  'profile',
  'system',
  'official',
  'writehabit',
  'editor',
  'test',
  'user',
]);

export const sanitizeHandle = (value) =>
  (value || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');

const collectTakenHandles = (knownHandles = []) => {
  const set = new Set(RESERVED_HANDLES);
  try {
    knownHandles.forEach((handle) => handle && set.add(handle));
    const persisted = JSON.parse(localStorage.getItem('wh_posts') || '[]');
    if (Array.isArray(persisted)) persisted.forEach((post) => post.handle && set.add(post.handle));
    set.add('minji');
  } catch {}
  return set;
};

export const checkHandleAvailable = (handle, currentHandle, knownHandles = []) =>
  new Promise((resolve) => {
    setTimeout(() => {
      if (currentHandle && handle === currentHandle) {
        resolve('ok');
        return;
      }
      const taken = collectTakenHandles(knownHandles);
      resolve(taken.has(handle) ? 'taken' : 'ok');
    }, 380);
  });
