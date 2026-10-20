// Saves data in the browser's localStorage, so it survives closing the app.
// Every read/write goes through this file, so swapping to a server database
// later only means changing this one file.

const KEYS = { profile: 'nt.profile', foods: 'nt.foods', log: 'nt.log' };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Today's date as YYYY-MM-DD in your local time zone. */
export function todayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---- Profile ----
export const getProfile = () => read(KEYS.profile, null);
export const saveProfile = (profile) => write(KEYS.profile, profile);

// ---- My Foods ----
export const getFoods = () => read(KEYS.foods, []);

/** Saves a food; if one with the same name exists, it's updated instead of duplicated. */
export function saveFood(food) {
  const foods = getFoods();
  const index = foods.findIndex((f) => f.name.toLowerCase() === food.name.toLowerCase());
  if (index >= 0) foods[index] = { ...foods[index], ...food, id: foods[index].id };
  else foods.push({ ...food, id: newId() });
  foods.sort((a, b) => a.name.localeCompare(b.name));
  write(KEYS.foods, foods);
}

export function deleteFood(id) {
  write(KEYS.foods, getFoods().filter((f) => f.id !== id));
}

// ---- Food log ----
export const getLog = () => read(KEYS.log, []);
export const getEntriesForDate = (date) => getLog().filter((e) => e.date === date);

export function addLogEntry(entry) {
  const log = getLog();
  log.push({ ...entry, id: newId(), date: entry.date || todayKey(), loggedAt: new Date().toISOString() });
  write(KEYS.log, log);
}

export function deleteLogEntry(id) {
  write(KEYS.log, getLog().filter((e) => e.id !== id));
}
