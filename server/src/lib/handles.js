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

export const normalizeHandle = (value) => (value || '').trim().toLowerCase();

export const isReservedHandle = (handle) => RESERVED_HANDLES.has(normalizeHandle(handle));
