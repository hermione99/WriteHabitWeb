import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const stamp = Date.now();
const userA = {
  email: `smoke-a-${stamp}@test.local`,
  password: 'smoketest123',
  displayName: `스모크A${stamp}`,
  handle: `smokea${stamp}`,
};
const userB = {
  email: `smoke-b-${stamp}@test.local`,
  password: 'smoketest123',
  displayName: `스모크B${stamp}`,
  handle: `smokeb${stamp}`,
};
const ADMIN = { email: 'admin@writehabit.local', password: 'writehabit123' };

const ctx = {};

after(async () => {
  await prisma.$disconnect();
});

test('health endpoint responds', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
});

test('register + login userA', async () => {
  const reg = await request(app).post('/api/auth/register').send(userA);
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.ok(reg.body.accessToken);
  ctx.tokenA = reg.body.accessToken;
  ctx.userIdA = reg.body.user.id;
});

test('register userB', async () => {
  const reg = await request(app).post('/api/auth/register').send(userB);
  assert.equal(reg.status, 201);
  ctx.tokenB = reg.body.accessToken;
  ctx.handleB = reg.body.user.handle;
});

test('getMe returns userA', async () => {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${ctx.tokenA}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, userA.email);
});

test('userA creates a post', async () => {
  const res = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${ctx.tokenA}`)
    .send({ title: `스모크 제목 ${stamp}`, body: `스모크 본문 내용 ${stamp} 검색용 단어 zebracorn` });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.post.id);
  ctx.postId = res.body.post.id;
});

test('list posts includes the new post', async () => {
  const res = await request(app).get('/api/posts');
  assert.equal(res.status, 200);
  assert.ok(res.body.posts.some((p) => p.id === ctx.postId));
});

test('search by unique body word finds the post', async () => {
  const res = await request(app).get('/api/posts').query({ q: 'zebracorn' });
  assert.equal(res.status, 200);
  assert.ok(res.body.posts.some((p) => p.id === ctx.postId), 'expected post in search results');
});

test('search by author handle finds the post', async () => {
  const res = await request(app).get('/api/posts').query({ q: userA.handle });
  assert.equal(res.status, 200);
  assert.ok(res.body.posts.some((p) => p.id === ctx.postId));
});

test('userB likes the post', async () => {
  const res = await request(app)
    .post(`/api/posts/${ctx.postId}/like`)
    .set('Authorization', `Bearer ${ctx.tokenB}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.post.likes, 1);
  assert.equal(res.body.post.liked, true);
});

test('userA receives a like notification', async () => {
  const res = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${ctx.tokenA}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.notifications.some((n) => n.type === 'like'));
});

test('userB comments on the post', async () => {
  const res = await request(app)
    .post(`/api/posts/${ctx.postId}/comments`)
    .set('Authorization', `Bearer ${ctx.tokenB}`)
    .send({ body: '스모크 댓글입니다.' });
  assert.equal(res.status, 201);
  ctx.commentId = res.body.comment.id;
});

test('userB follows userA', async () => {
  const res = await request(app)
    .post(`/api/users/${userA.handle}/follow`)
    .set('Authorization', `Bearer ${ctx.tokenB}`);
  assert.ok([200, 201, 204].includes(res.status), `unexpected status ${res.status}`);
});

test('userB reports the post', async () => {
  const res = await request(app)
    .post('/api/reports')
    .set('Authorization', `Bearer ${ctx.tokenB}`)
    .send({ targetType: 'post', targetId: ctx.postId, reason: 'spam', detail: '스모크 신고' });
  assert.ok([200, 201].includes(res.status), JSON.stringify(res.body));
});

test('admin login', async () => {
  const res = await request(app).post('/api/auth/login').send(ADMIN);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  ctx.adminToken = res.body.accessToken;
});

test('admin sees the report and resolves it (post becomes hidden)', async () => {
  const list = await request(app)
    .get('/api/admin/reports')
    .set('Authorization', `Bearer ${ctx.adminToken}`);
  assert.equal(list.status, 200);
  const target = list.body.reports.find((r) => r.postId === ctx.postId);
  assert.ok(target, 'admin should see report for the smoke post');

  const patch = await request(app)
    .patch(`/api/admin/reports/${target.id}`)
    .set('Authorization', `Bearer ${ctx.adminToken}`)
    .send({ status: 'resolved' });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.report.postStatus, 'hidden');

  const detail = await request(app).get(`/api/posts/${ctx.postId}`);
  assert.equal(detail.status, 404, 'hidden post should be 404 to public');
});

test('cleanup: delete test users + post', async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [userA.email, userB.email] } },
  });
  // Cascade should remove the post + report + like + comment + follow.
  const remaining = await prisma.post.findUnique({ where: { id: ctx.postId } });
  assert.equal(remaining, null);
});
