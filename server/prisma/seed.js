import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const startOfDay = (offsetDays = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
};

const buildUser = async ({ email, handle, displayName, bio, role = 'USER' }) => ({
  email,
  handle,
  displayName,
  bio,
  role,
  passwordHash: await bcrypt.hash('writehabit123', 12),
});

const upsertUser = async (data) =>
  prisma.user.upsert({
    where: { email: data.email },
    update: {
      handle: data.handle,
      displayName: data.displayName,
      bio: data.bio,
      role: data.role,
    },
    create: data,
  });

const upsertKeywordSchedule = async ({ text, eng, prompt, status, offsetDays }) => {
  const startsAt = startOfDay(offsetDays);
  const keyword = await prisma.keyword.upsert({
    where: {
      text_publishDate: {
        text,
        publishDate: startsAt,
      },
    },
    update: {
      eng,
      prompt,
      status,
    },
    create: {
      text,
      eng,
      prompt,
      status,
      publishDate: startsAt,
    },
  });

  const existingSchedule = await prisma.keywordSchedule.findFirst({
    where: {
      keywordId: keyword.id,
      startsAt,
    },
  });

  if (existingSchedule) {
    return prisma.keywordSchedule.update({
      where: { id: existingSchedule.id },
      data: { status },
    });
  }

  return prisma.keywordSchedule.create({
    data: {
      keywordId: keyword.id,
      startsAt,
      status,
    },
  });
};

const upsertPost = async ({ authorId, title, body, status = 'PUBLISHED' }) => {
  const existing = await prisma.post.findFirst({
    where: {
      authorId,
      title,
    },
  });

  if (existing) {
    return prisma.post.update({
      where: { id: existing.id },
      data: {
        body,
        status,
      },
    });
  }

  return prisma.post.create({
    data: {
      authorId,
      title,
      body,
      status,
    },
  });
};

const main = async () => {
  const admin = await upsertUser(
    await buildUser({
      email: 'admin@writehabit.local',
      handle: 'admin',
      displayName: '운영팀',
      bio: 'WriteHabit 운영 계정입니다.',
      role: 'ADMIN',
    })
  );

  const demoUser = await upsertUser(
    await buildUser({
      email: 'demo@writehabit.local',
      handle: 'demo',
      displayName: '데모 작가',
      bio: '매일 짧게 쓰는 습관을 연습하고 있어요.',
    })
  );

  await upsertKeywordSchedule({
    text: '시작',
    eng: 'beginning',
    prompt: '오늘 새롭게 시작하고 싶은 한 가지를 적어보세요.',
    status: 'ACTIVE',
    offsetDays: 0,
  });

  await upsertKeywordSchedule({
    text: '리듬',
    eng: 'rhythm',
    prompt: '나에게 맞는 하루의 리듬은 어떤 모습인가요?',
    status: 'SCHEDULED',
    offsetDays: 1,
  });

  await upsertKeywordSchedule({
    text: '정리',
    eng: 'organize',
    prompt: '지금 마음속에서 정리하고 싶은 생각을 써보세요.',
    status: 'SCHEDULED',
    offsetDays: 2,
  });

  const firstPost = await upsertPost({
    authorId: demoUser.id,
    title: '첫 문장을 쓰는 연습',
    body:
      '오늘은 완벽한 글보다 계속 이어지는 글을 목표로 했다. 짧아도 괜찮다고 정하니 첫 문장이 훨씬 쉽게 나왔다.',
  });

  await upsertPost({
    authorId: admin.id,
    title: 'WriteHabit에 오신 것을 환영합니다',
    body:
      'WriteHabit은 매일 하나의 키워드로 글쓰기 습관을 만드는 공간입니다. 오늘의 키워드를 보고 부담 없이 한 단락부터 시작해보세요.',
  });

  await upsertPost({
    authorId: demoUser.id,
    title: '임시저장 테스트 글',
    body: '이 글은 글쓰기 화면의 임시저장 불러오기 흐름을 확인하기 위한 초안입니다.',
    status: 'DRAFT',
  });

  await prisma.comment.upsert({
    where: {
      id: 'seed-comment-welcome',
    },
    update: {
      body: '첫 글 좋아요. 짧아도 계속 쓰는 게 핵심인 것 같아요.',
    },
    create: {
      id: 'seed-comment-welcome',
      postId: firstPost.id,
      authorId: admin.id,
      body: '첫 글 좋아요. 짧아도 계속 쓰는 게 핵심인 것 같아요.',
    },
  });

  await prisma.like.upsert({
    where: {
      postId_userId: {
        postId: firstPost.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      postId: firstPost.id,
      userId: admin.id,
    },
  });

  console.log('Seed completed.');
  console.log('Admin: admin@writehabit.local / writehabit123');
  console.log('Demo:  demo@writehabit.local / writehabit123');
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
