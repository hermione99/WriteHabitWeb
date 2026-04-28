export const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  handle: user.handle,
  displayName: user.displayName,
  bio: user.bio,
  role: user.role,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
