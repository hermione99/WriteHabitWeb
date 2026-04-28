export const readJSON = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export const readString = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export const writeString = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export const removeStorageKeys = (keys) => {
  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
};

export const readSet = (key) => new Set(readJSON(key, []));

export const writeSet = (key, set) => {
  writeJSON(key, [...set]);
};

export const readReports = () => readJSON('wh_reports', []);

export const writeReports = (reports) => {
  writeJSON('wh_reports', reports);
};
