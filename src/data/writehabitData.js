/* ── Today's keyword (rotates daily, unique within a year) ── */
export const KEYWORD_POOL = [
  // 감정 (Emotions)
  ['이별','FAREWELL'],['만남','ENCOUNTER'],['사랑','LOVE'],['미움','HATRED'],['그리움','LONGING'],
  ['외로움','LONELINESS'],['기쁨','JOY'],['슬픔','SORROW'],['분노','ANGER'],['두려움','FEAR'],
  ['평화','PEACE'],['불안','ANXIETY'],['후회','REGRET'],['희망','HOPE'],['절망','DESPAIR'],
  ['위로','COMFORT'],['안도','RELIEF'],['설렘','FLUTTER'],['떨림','TREMBLE'],['긴장','TENSION'],
  ['부끄러움','SHAME'],['자부심','PRIDE'],['감사','GRATITUDE'],['미안함','SORRY'],['시샘','ENVY'],
  ['호기심','CURIOSITY'],['권태','BOREDOM'],['감동','EMOTION'],['환희','ELATION'],['우울','MELANCHOLY'],
  ['명랑','CHEER'],['다정','TENDERNESS'],['무관심','INDIFFERENCE'],['연민','PITY'],['열정','PASSION'],

  // 계절·날씨 (Seasons & Weather)
  ['봄','SPRING'],['여름','SUMMER'],['가을','AUTUMN'],['겨울','WINTER'],
  ['새봄','EARLY SPRING'],['늦봄','LATE SPRING'],['한여름','MIDSUMMER'],['늦여름','LATE SUMMER'],
  ['초가을','EARLY AUTUMN'],['늦가을','LATE AUTUMN'],['초겨울','EARLY WINTER'],['한겨울','MIDWINTER'],
  ['비','RAIN'],['눈','SNOW'],['바람','WIND'],['햇살','SUNLIGHT'],['구름','CLOUD'],
  ['별','STAR'],['달','MOON'],['해','SUN'],['노을','SUNSET GLOW'],['안개','FOG'],
  ['서리','FROST'],['이슬','DEW'],['무지개','RAINBOW'],['천둥','THUNDER'],['번개','LIGHTNING'],
  ['폭풍','STORM'],['파도','WAVE'],['봄비','SPRING RAIN'],['가랑비','DRIZZLE'],['소나기','SHOWER'],
  ['장마','MONSOON'],['첫눈','FIRST SNOW'],['봄바람','SPRING BREEZE'],

  // 시간 (Times of day)
  ['새벽','DAWN'],['아침','MORNING'],['정오','NOON'],['오후','AFTERNOON'],['저녁','EVENING'],
  ['밤','NIGHT'],['한밤','MIDNIGHT'],['자정','MIDNIGHT HOUR'],['황혼','TWILIGHT'],['동틀녘','DAYBREAK'],
  ['일출','SUNRISE'],['일몰','SUNSET'],['한낮','BROAD DAYLIGHT'],['늦은밤','LATE NIGHT'],['초저녁','EARLY EVENING'],

  // 장소 (Places)
  ['집','HOME'],['방','ROOM'],['부엌','KITCHEN'],['마당','YARD'],['골목','ALLEY'],
  ['거리','STREET'],['광장','PLAZA'],['공원','PARK'],['학교','SCHOOL'],['도서관','LIBRARY'],
  ['카페','CAFE'],['식당','RESTAURANT'],['바다','SEA'],['강','RIVER'],['산','MOUNTAIN'],
  ['들','FIELD'],['숲','FOREST'],['정원','GARDEN'],['시장','MARKET'],['다리','BRIDGE'],
  ['항구','HARBOR'],['기차역','TRAIN STATION'],['공항','AIRPORT'],['정류장','BUS STOP'],['옥상','ROOFTOP'],
  ['지하철','SUBWAY'],['가게','SHOP'],['약국','PHARMACY'],['병원','HOSPITAL'],['사찰','TEMPLE'],
  ['시골','COUNTRYSIDE'],['도시','CITY'],['동네','NEIGHBORHOOD'],['다락방','ATTIC'],['베란다','VERANDA'],
  ['창가','BY THE WINDOW'],['발코니','BALCONY'],

  // 자연·생명 (Nature & Life)
  ['나무','TREE'],['꽃','FLOWER'],['잎사귀','LEAF'],['풀','GRASS'],['새','BIRD'],
  ['나비','BUTTERFLY'],['강아지','PUPPY'],['고양이','CAT'],['물고기','FISH'],['사슴','DEER'],

  // 사물 (Objects)
  ['책','BOOK'],['편지','LETTER'],['사진','PHOTO'],['거울','MIRROR'],['시계','CLOCK'],
  ['열쇠','KEY'],['우산','UMBRELLA'],['안경','GLASSES'],['손수건','HANDKERCHIEF'],['노트','NOTEBOOK'],
  ['펜','PEN'],['가방','BAG'],['신발','SHOES'],['반지','RING'],['목걸이','NECKLACE'],
  ['모자','HAT'],['외투','COAT'],['스카프','SCARF'],['컵','CUP'],['의자','CHAIR'],
  ['책상','DESK'],['침대','BED'],['창문','WINDOW'],['문','DOOR'],['계단','STAIRS'],
  ['벽','WALL'],['그림','PAINTING'],

  // 음식 (Food)
  ['밥','MEAL'],['국','SOUP'],['김치','KIMCHI'],['차','TEA'],['커피','COFFEE'],
  ['빵','BREAD'],['케이크','CAKE'],['술','LIQUOR'],['막걸리','MAKGEOLLI'],['라면','RAMEN'],
  ['떡','RICE CAKE'],['과일','FRUIT'],['사과','APPLE'],['귤','TANGERINE'],['포도','GRAPE'],
  ['딸기','STRAWBERRY'],['초콜릿','CHOCOLATE'],['사탕','CANDY'],['우유','MILK'],['차한잔','A CUP OF TEA'],

  // 추상 (Abstract concepts)
  ['시간','TIME'],['기억','MEMORY'],['추억','REMINISCENCE'],['꿈','DREAM'],['진실','TRUTH'],
  ['거짓','LIE'],['비밀','SECRET'],['약속','PROMISE'],['침묵','SILENCE'],['소리','SOUND'],
  ['빛','LIGHT'],['어둠','DARKNESS'],['그림자','SHADOW'],['기다림','WAITING'],['시작','BEGINNING'],
  ['끝','END'],['길','PATH'],['우연','COINCIDENCE'],['운명','DESTINY'],['자유','FREEDOM'],
  ['책임','RESPONSIBILITY'],['용기','COURAGE'],['인생','LIFE'],['죽음','DEATH'],['탄생','BIRTH'],
  ['변화','CHANGE'],['고요','QUIET'],['흔적','TRACE'],['유년','CHILDHOOD'],['청춘','YOUTH'],
  ['노년','OLD AGE'],['여정','JOURNEY'],['도전','CHALLENGE'],['행운','LUCK'],['신뢰','TRUST'],
  ['의심','DOUBT'],['고독','SOLITUDE'],['오해','MISUNDERSTANDING'],['이해','UNDERSTANDING'],['용서','FORGIVENESS'],

  // 사람·관계 (People & Relations)
  ['어머니','MOTHER'],['아버지','FATHER'],['형제','BROTHER'],['자매','SISTER'],['친구','FRIEND'],
  ['연인','LOVER'],['이웃','NEIGHBOR'],['스승','TEACHER'],['동료','COLLEAGUE'],['어린이','CHILD'],
  ['노인','ELDER'],['가족','FAMILY'],['첫사랑','FIRST LOVE'],['외할머니','GRANDMA'],['할아버지','GRANDPA'],

  // 활동·상태 (Activities & States)
  ['산책','WALK'],['잠','SLEEP'],['휴식','REST'],['청소','CLEANING'],['요리','COOKING'],
  ['독서','READING'],['글쓰기','WRITING'],['노래','SONG'],['춤','DANCE'],['여행','JOURNEY'],
  ['명상','MEDITATION'],['한숨','SIGH'],['숨','BREATH'],['눈물','TEAR'],['웃음','LAUGHTER'],
].map(([word, eng]) => ({ word, eng }));

/* Rich descriptions for select keywords (others fall back to a generic prompt) */
const KEYWORD_SUBS = {
  '이별':   '우리는 매일 무언가와 헤어진다. 오늘은 당신의 이별을 글로 남겨보세요. 그 순간의 공기, 감정의 결, 남겨진 자리까지 — 가장 작은 순간이 가장 오래 남습니다.',
  '비':     '창밖의 빗소리에 귀를 기울여보세요. 비는 저마다 다른 기억을 데려옵니다. 오늘의 비, 어제의 비, 그리고 아직 오지 않은 비를 적어 보세요.',
  '청춘':   '다시 오지 않을 시간들에 대하여. 어쩌면 지금이 누군가의 청춘일지도 모릅니다. 당신의 청춘을 짧게 정의해 보세요.',
  '새벽':   '고요한 시간에만 보이는 것들이 있습니다. 새벽에 깨어 있던 어느 날의 마음을 글로 남겨보세요.',
  '기억':   '잊혀지지 않는 한 장면이 있나요. 그 장면을 단 한 문단으로 옮겨 보세요. 디테일이 곧 진실입니다.',
  '후회':   '돌이킬 수 없는 것을 안고 사는 법. 작은 후회 하나를 꺼내, 오늘의 당신에게 들려주세요.',
  '고요':   '말할 수 없는 것들에 대하여. 아무 소리도 없는 시간을 글로 옮겨 보세요.',
  '바람':   '스쳐 지나간 것들의 흔적. 오늘 당신을 스쳐간 바람은 무엇이었나요.',
  '봄':     '다시 시작되는 것들에 대해. 매년 같은 봄이 와도, 매년 다르게 느껴지는 이유를 적어 보세요.',
  '그리움': '멀리 있는 것들에 대한 마음. 누군가, 어떤 시절, 어떤 장소 — 무엇이든 좋습니다.',
  '희망':   '어둠 속에서 켜지는 작은 불빛. 오늘 당신을 살게 한 희망 하나를 적어 보세요.',
  '순간':   '영원히 붙잡고 싶은 한 순간. 그 순간의 빛과 소리와 공기를 짧게 옮겨 보세요.',
  '사랑':   '설명할 수 없는 마음의 결. 거창하지 않아도 좋습니다. 작고 사적인 사랑에 대해 써보세요.',
  '빛':     '어디선가 들어오는 한 줄기. 오늘 당신이 본 빛은 어디에서 왔나요.',
};

/* Mulberry32: deterministic seeded PRNG */
function _mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function _shuffleSeeded(arr, seed) {
  const rng = _mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LAUNCH_DATE = new Date(2026, 3, 1); // 2026·04·01 (day 1)
const _today      = new Date();
const _yearStart  = Date.UTC(_today.getFullYear(), 0, 1);
const _todayUTC   = Date.UTC(_today.getFullYear(), _today.getMonth(), _today.getDate());
const _dayOfYear  = Math.floor((_todayUTC - _yearStart) / 86400000); // 0-based
const _dayNum     = Math.floor((_todayUTC - Date.UTC(LAUNCH_DATE.getFullYear(), LAUNCH_DATE.getMonth(), LAUNCH_DATE.getDate())) / 86400000) + 1;

/* Year-seeded shuffle: each year's order is unique, no repeats within the year (pool > 366) */
const _shuffledPool = _shuffleSeeded(KEYWORD_POOL, _today.getFullYear() * 31 + 7);
const _picked       = _shuffledPool[_dayOfYear % _shuffledPool.length];
const _pad2         = n => String(n).padStart(2, '0');

export const TODAY_KW = {
  word:    _picked.word,
  eng:     _picked.eng,
  sub:     KEYWORD_SUBS[_picked.word] || `오늘의 키워드는 '${_picked.word}'입니다. 이 단어가 당신에게 불러오는 한 장면, 한 감정, 한 기억을 짧게 적어 보세요.`,
  no:      String(_dayNum).padStart(4, '0'),
  dateStr: `${_today.getFullYear()}·${_pad2(_today.getMonth()+1)}·${_pad2(_today.getDate())}`,
  weekday: ['일','월','화','수','목','금','토'][_today.getDay()],
};

export const DEFAULT_PREFS = {
  emailDigest: true,
  notifLike: true,
  notifComment: true,
  notifFollow: true,
  notifSystem: true,
};

export const KEYWORDS_ARCHIVE = [
  { date:'04·22', word:'행복', count:1842, eng:'HAPPINESS' },
  { date:'04·21', word:'청춘', count:2104, eng:'YOUTH' },
  { date:'04·20', word:'미래', count:1567, eng:'FUTURE' },
  { date:'04·19', word:'고독', count:1389, eng:'SOLITUDE' },
  { date:'04·18', word:'기억', count:1924, eng:'MEMORY' },
  { date:'04·17', word:'용기', count:1231, eng:'COURAGE' },
  { date:'04·16', word:'새벽', count:1678, eng:'DAWN' },
  { date:'04·15', word:'후회', count:1433, eng:'REGRET' },
  { date:'04·14', word:'설렘', count:1912, eng:'FLUTTER' },
  { date:'04·13', word:'침묵', count: 987, eng:'SILENCE' },
  { date:'04·12', word:'바람', count:1344, eng:'WIND' },
  { date:'04·11', word:'봄',   count:2341, eng:'SPRING' },
  { date:'04·10', word:'그리움', count:1788, eng:'LONGING' },
  { date:'04·09', word:'희망', count:1622, eng:'HOPE' },
  { date:'04·08', word:'순간', count:1456, eng:'MOMENT' },
  { date:'04·07', word:'사랑', count:2876, eng:'LOVE' },
  { date:'04·06', word:'빛',   count:1203, eng:'LIGHT' },
  { date:'04·05', word:'여행', count:1534, eng:'JOURNEY' },
  { date:'04·04', word:'집',   count:1098, eng:'HOME' },
  { date:'04·03', word:'밤',   count:1867, eng:'NIGHT' },
];

export const ACCOUNT_STORAGE_KEYS = [
  'wh_logged_in',
  'wh_profile',
  'wh_posts',
  'wh_comments',
  'wh_follows',
  'wh_blocks',
  'wh_reports',
  'wh_notifications',
  'wh_prefs',
  'wh_draft',
  'wh_onboarded',
];
