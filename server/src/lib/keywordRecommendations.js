const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_MS = 24 * 60 * 60 * 1000;

const KEYWORD_POOL = [
  ['이별', 'FAREWELL', '감정'],
  ['만남', 'ENCOUNTER', '관계'],
  ['사랑', 'LOVE', '감정'],
  ['그리움', 'LONGING', '감정'],
  ['외로움', 'LONELINESS', '감정'],
  ['기쁨', 'JOY', '감정'],
  ['후회', 'REGRET', '감정'],
  ['희망', 'HOPE', '감정'],
  ['위로', 'COMFORT', '감정'],
  ['감사', 'GRATITUDE', '감정'],
  ['봄', 'SPRING', '계절'],
  ['여름', 'SUMMER', '계절'],
  ['가을', 'AUTUMN', '계절'],
  ['겨울', 'WINTER', '계절'],
  ['비', 'RAIN', '계절'],
  ['눈', 'SNOW', '계절'],
  ['바람', 'WIND', '계절'],
  ['햇살', 'SUNLIGHT', '계절'],
  ['노을', 'SUNSET GLOW', '계절'],
  ['새벽', 'DAWN', '시간'],
  ['아침', 'MORNING', '시간'],
  ['저녁', 'EVENING', '시간'],
  ['밤', 'NIGHT', '시간'],
  ['집', 'HOME', '장소'],
  ['방', 'ROOM', '장소'],
  ['골목', 'ALLEY', '장소'],
  ['공원', 'PARK', '장소'],
  ['도서관', 'LIBRARY', '장소'],
  ['카페', 'CAFE', '장소'],
  ['바다', 'SEA', '장소'],
  ['숲', 'FOREST', '장소'],
  ['책', 'BOOK', '사물'],
  ['편지', 'LETTER', '사물'],
  ['사진', 'PHOTO', '사물'],
  ['거울', 'MIRROR', '사물'],
  ['시계', 'CLOCK', '사물'],
  ['우산', 'UMBRELLA', '사물'],
  ['커피', 'COFFEE', '음식'],
  ['차', 'TEA', '음식'],
  ['빵', 'BREAD', '음식'],
  ['시간', 'TIME', '추상'],
  ['기억', 'MEMORY', '추상'],
  ['꿈', 'DREAM', '추상'],
  ['비밀', 'SECRET', '추상'],
  ['약속', 'PROMISE', '추상'],
  ['침묵', 'SILENCE', '추상'],
  ['빛', 'LIGHT', '추상'],
  ['기다림', 'WAITING', '추상'],
  ['시작', 'BEGINNING', '추상'],
  ['길', 'PATH', '추상'],
  ['자유', 'FREEDOM', '추상'],
  ['용기', 'COURAGE', '추상'],
  ['고요', 'QUIET', '추상'],
  ['청춘', 'YOUTH', '추상'],
  ['가족', 'FAMILY', '관계'],
  ['친구', 'FRIEND', '관계'],
  ['이웃', 'NEIGHBOR', '관계'],
  ['산책', 'WALK', '활동'],
  ['휴식', 'REST', '활동'],
  ['요리', 'COOKING', '활동'],
  ['독서', 'READING', '활동'],
  ['글쓰기', 'WRITING', '활동'],
].map(([word, eng, category]) => ({ word, eng, category }));

const CATEGORY_PROMPTS = {
  감정: '이 감정이 가장 선명했던 순간을 한 장면으로 적어보세요.',
  계절: '계절과 날씨가 데려온 기억 하나를 짧게 꺼내보세요.',
  시간: '그 시간대에만 떠오르는 마음이나 풍경을 써보세요.',
  장소: '그 장소에 남아 있는 냄새, 소리, 마음을 기록해보세요.',
  사물: '이 사물이 간직한 기억이나 관계를 한 문단으로 옮겨보세요.',
  음식: '맛과 온도, 함께 있던 사람을 중심으로 써보세요.',
  추상: '이 단어가 당신의 오늘에 닿는 방식을 구체적인 장면으로 적어보세요.',
  관계: '누군가와의 거리, 말하지 못한 마음, 남은 감정을 써보세요.',
  활동: '이 행동을 하던 어느 날의 리듬과 감각을 적어보세요.',
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatDate = (date) => `${pad2(date.getMonth() + 1)}·${pad2(date.getDate())}`;

const seededScore = (word, date, index) => {
  const seed = `${word}:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}:${index}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const seasonalCategories = (date) => {
  const month = date.getMonth() + 1;
  if ([3, 4, 5].includes(month)) return new Set(['계절', '장소', '활동', '추상']);
  if ([6, 7, 8].includes(month)) return new Set(['계절', '음식', '장소', '활동']);
  if ([9, 10, 11].includes(month)) return new Set(['감정', '시간', '추상', '사물']);
  return new Set(['감정', '계절', '관계', '시간']);
};

const nextRecommendationDate = (existingSchedules) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latest = existingSchedules.reduce((max, item) => {
    const startsAt = new Date(item.startsAt);
    return startsAt > max ? startsAt : max;
  }, today);
  return new Date(latest.getTime() + DAY_MS);
};

export const recommendKeywords = ({ count = 7, existingSchedules = [] }) => {
  const usedWords = new Set(
    existingSchedules
      .map((item) => item.keyword?.text)
      .filter(Boolean)
  );
  let cursor = nextRecommendationDate(existingSchedules);
  const picks = [];
  const recentCategories = [];

  while (picks.length < count && picks.length < KEYWORD_POOL.length) {
    const preferred = seasonalCategories(cursor);
    const candidates = KEYWORD_POOL
      .filter((item) => !usedWords.has(item.word))
      .filter((item) => !recentCategories.slice(-2).includes(item.category))
      .map((item, index) => ({
        ...item,
        score: seededScore(item.word, cursor, index) - (preferred.has(item.category) ? 500000 : 0),
      }))
      .sort((a, b) => a.score - b.score);

    const pick = candidates[0] || KEYWORD_POOL.find((item) => !usedWords.has(item.word));
    if (!pick) break;

    const date = formatDate(cursor);
    picks.push({
      date,
      day: DAY_LABELS[cursor.getDay()],
      word: pick.word,
      eng: pick.eng,
      category: pick.category,
      prompt: `오늘의 키워드는 '${pick.word}'입니다. ${CATEGORY_PROMPTS[pick.category]}`,
      reason: `${pick.category} 카테고리 균형, 계절성, 최근 사용 이력을 반영했습니다.`,
    });

    usedWords.add(pick.word);
    recentCategories.push(pick.category);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  return picks;
};
