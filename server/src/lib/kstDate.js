const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export const getKstParts = (date = new Date()) => {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
};

export const utcDateFromParts = ({ year, month, day }) =>
  new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

export const startOfKstTodayAsUtcDate = (date = new Date()) =>
  utcDateFromParts(getKstParts(date));

export const addUtcDays = (date, days) => new Date(date.getTime() + DAY_MS * days);

export const getUtcDateParts = (date) => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth(),
  day: date.getUTCDate(),
  weekday: date.getUTCDay(),
});
