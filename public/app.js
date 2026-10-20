// Wires the screens together: reads forms, saves data, and redraws the page.

import { ACTIVITY_LEVELS, GOALS, NUTRIENTS, FAT_SHARE, FIBER_PER_1000_KCAL, calculateTargets, amountsForGrams, sumEntries } from './nutrition.js';
import * as store from './storage.js';

const $ = (selector) => document.querySelector(selector);
const MACROS = NUTRIENTS.map((n) => n.key);
const TITLES = { today: 'Today', log: 'Log food', foods: 'My Foods', profile: 'Profile' };

// ---------- Small helpers ----------

/** Creates an element; text is set with textContent so food names can't inject HTML. */
function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString();

function macroLine(values) {
  return `${fmt(values.calories)} kcal · P ${fmt(values.protein)}g · C ${fmt(values.carbs)}g · F ${fmt(values.fat)}g · Fiber ${fmt(values.fiber)}g`;
}

let toastTimer;
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/** Reads a number field; returns NaN if blank or invalid. */
function num(form, name) {
  const raw = form.elements[name].value.trim();
  return raw === '' ? NaN : Number(raw);
}

// ---------- Navigation (bottom tabs) ----------

function showView() {
  const tab = TITLES[location.hash.slice(1)] ? location.hash.slice(1) : 'today';
  for (const view of document.querySelectorAll('.view')) view.hidden = view.id !== `view-${tab}`;
  for (const link of document.querySelectorAll('.tabbar a')) link.classList.toggle('active', link.dataset.tab === tab);
  $('#page-title').textContent = TITLES[tab];
  document.title = `${TITLES[tab]} · Nutrition Tracker`;
  renderers[tab]();
  window.scrollTo(0, 0);
}

// ---------- Today (dashboard) ----------

function renderToday() {
  const today = store.todayKey();
  $('#today-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const profile = store.getProfile();
  const entries = store.getEntriesForDate(today);
  const totals = sumEntries(entries);

  $('#no-profile').hidden = Boolean(profile);
  const progress = $('#progress');
  progress.hidden = !profile;
  progress.replaceChildren();

  if (profile) {
    const { targets } = calculateTargets(profile);
    for (const { key, label, unit } of NUTRIENTS) {
      const eaten = totals[key];
      const target = targets[key];
      const pct = target > 0 ? (eaten / target) * 100 : 0;
      const left = target - eaten;
      const status = left >= 0 ? `${fmt(left)} ${unit} left` : `${fmt(-left)} ${unit} over`;
      progress.append(
        el('div', { className: `bar-row${pct > 100 ? ' over' : ''}` }, [
          el('div', { className: 'bar-label' }, [
            el('span', { text: label }),
            el('span', { className: 'value', text: `${fmt(eaten)} / ${fmt(target)} ${unit} · ${status}` }),
          ]),
          el('div', { className: 'bar', attrs: { role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': String(target), 'aria-valuenow': String(eaten) } }, [
            el('div', { className: 'bar-fill', attrs: { style: `width:${Math.min(pct, 100)}%` } }),
          ]),
        ]),
      );
    }
  }

  const list = $('#today-entries');
  list.replaceChildren();
  if (!entries.length) {
    list.append(el('li', { className: 'empty', text: 'Nothing logged yet today.' }));
    return;
  }
  for (const entry of entries.slice().reverse()) {
    const remove = el('button', { className: 'icon-btn', text: '✕', attrs: { 'aria-label': `Remove ${entry.name}`, type: 'button' } });
    remove.addEventListener('click', () => {
      if (!confirm(`Remove ${entry.name} from today?`)) return;
      store.deleteLogEntry(entry.id);
      renderToday();
    });
    list.append(
      el('li', {}, [
        el('div', { className: 'info' }, [
          el('div', { className: 'name', text: `${entry.name} · ${fmt(entry.grams)} g` }),
          el('div', { className: 'sub', text: macroLine(entry.amounts) }),
        ]),
        remove,
      ]),
    );
  }
}

// ---------- Log food ----------

function readLogForm() {
  const form = $('#log-form');
  const name = form.elements.name.value.trim();
  const grams = num(form, 'grams');
  const per100 = {};
  for (const key of MACROS) {
    const value = num(form, key);
    per100[key] = key === 'fiber' && Number.isNaN(value) ? 0 : value; // fiber is optional
  }
  return { name, grams, per100 };
}

function validateLog({ name, grams, per100 }) {
  if (!name) return 'Please enter a food name.';
  if (!(grams > 0)) return 'Please enter how many grams you ate.';
  for (const { key, label } of NUTRIENTS) {
    if (Number.isNaN(per100[key]) || per100[key] < 0) return `Please enter ${label.toLowerCase()} per 100 g (use 0 if none).`;
  }
  if (per100.protein + per100.carbs + per100.fat > 100) return 'Protein + carbs + fat can’t be more than 100 g per 100 g. Check the label.';
  return '';
}

function updateLogPreview() {
  const data = readLogForm();
  const ready = data.grams > 0 && ['calories', 'protein', 'carbs', 'fat'].every((k) => !Number.isNaN(data.per100[k]));
  $('#log-preview').textContent = ready ? `You ate: ${macroLine(amountsForGrams(data.per100, data.grams))}` : '';
}

function fillLogForm(food) {
  const form = $('#log-form');
  form.reset();
  form.elements.name.value = food.name;
  form.elements.grams.value = food.defaultGrams ?? '';
  for (const key of MACROS) form.elements[key].value = food.per100[key];
  updateLogPreview();
}

function logFood(name, grams, per100) {
  store.addLogEntry({ name, grams, per100, amounts: amountsForGrams(per100, grams) });
}

function setupLogForm() {
  const form = $('#log-form');
  form.addEventListener('input', updateLogPreview);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = readLogForm();
    const error = validateLog(data);
    $('#log-error').textContent = error;
    if (error) return;

    logFood(data.name, data.grams, data.per100);
    if (form.elements.saveToFoods.checked) {
      store.saveFood({ name: data.name, per100: data.per100, defaultGrams: data.grams });
    }
    form.reset();
    updateLogPreview();
    toast(`Logged ${data.name}`);
    location.hash = '#today';
  });
}

// ---------- My Foods ----------

function renderFoods() {
  const query = $('#food-search').value.trim().toLowerCase();
  const foods = store.getFoods().filter((f) => f.name.toLowerCase().includes(query));
  const list = $('#foods-list');
  list.replaceChildren();

  if (!foods.length) {
    list.append(el('li', { className: 'empty', text: query ? 'No matching foods.' : 'No saved foods yet. Log a food with “Also save to My Foods” ticked.' }));
    return;
  }

  for (const food of foods) {
    const logBtn = el('button', { className: 'button small', text: 'Log', attrs: { type: 'button' } });
    logBtn.addEventListener('click', () => {
      logFood(food.name, food.defaultGrams, food.per100);
      toast(`Logged ${fmt(food.defaultGrams)} g ${food.name}`);
    });

    const editBtn = el('button', { className: 'icon-btn', text: '✎', attrs: { type: 'button', 'aria-label': `Change amount for ${food.name}` } });
    editBtn.addEventListener('click', () => {
      location.hash = '#log';
      fillLogForm(food);
      $('#log-form').elements.grams.focus();
    });

    const deleteBtn = el('button', { className: 'icon-btn', text: '🗑', attrs: { type: 'button', 'aria-label': `Delete ${food.name}` } });
    deleteBtn.addEventListener('click', () => {
      if (!confirm(`Delete ${food.name} from My Foods?`)) return;
      store.deleteFood(food.id);
      renderFoods();
    });

    list.append(
      el('li', {}, [
        el('div', { className: 'info' }, [
          el('div', { className: 'name', text: food.name }),
          el('div', { className: 'sub', text: `Usual: ${fmt(food.defaultGrams)} g → ${macroLine(amountsForGrams(food.per100, food.defaultGrams))}` }),
        ]),
        editBtn,
        deleteBtn,
        logBtn,
      ]),
    );
  }
}

// ---------- Profile ----------

function fillSelect(select, options) {
  for (const [value, { label }] of Object.entries(options)) select.append(el('option', { text: label, attrs: { value } }));
}

function renderProfile() {
  const profile = store.getProfile();
  const form = $('#profile-form');
  if (profile) {
    for (const key of ['weight', 'height', 'age', 'sex', 'activity', 'goal']) form.elements[key].value = profile[key];
  } else {
    form.elements.activity.value = 'moderate';
    form.elements.goal.value = 'maintain';
  }
  renderTargets(profile);
}

function renderTargets(profile) {
  $('#targets-card').hidden = !profile;
  if (!profile) return;

  const { targets, steps } = calculateTargets(profile);
  const { weight, height, age, sex } = profile;
  const sexAdjust = sex === 'female' ? '− 161' : '+ 5';
  const fatCalories = targets.fat * 9;

  $('#targets-summary').replaceChildren(
    ...NUTRIENTS.map(({ key, label, unit }) =>
      el('div', { className: 'target' }, [el('strong', { text: `${fmt(targets[key])}${unit === 'g' ? ' g' : ''}` }), el('span', { text: unit === 'kcal' ? 'kcal / day' : label })]),
    ),
  );

  const stepsList = [
    ['1. Resting calories (BMR) — Mifflin-St Jeor equation',
      `10 × weight + 6.25 × height − 5 × age ${sexAdjust}`,
      `10 × ${weight} + 6.25 × ${height} − 5 × ${age} ${sexAdjust} = ${steps.bmr} kcal`],
    ['2. Daily burn (TDEE) — BMR × activity factor',
      `${steps.bmr} × ${steps.activity.factor} = ${steps.tdee} kcal`],
    [`3. Calories for your goal (${steps.goal.label}: ${steps.goal.note})`,
      `${steps.tdee} × ${steps.goal.calorieMultiplier} = ${targets.calories} kcal`],
    [`4. Protein — ${steps.goal.proteinPerKg} g per kg of body weight`,
      `${weight} × ${steps.goal.proteinPerKg} = ${targets.protein} g`],
    [`5. Fat — ${FAT_SHARE * 100}% of calories (fat has 9 kcal per gram)`,
      `${targets.calories} × ${FAT_SHARE} ÷ 9 = ${targets.fat} g`],
    ['6. Carbs — the calories left over (protein & carbs have 4 kcal per gram)',
      `(${targets.calories} − ${targets.protein} × 4 − ${fatCalories}) ÷ 4 = ${targets.carbs} g`],
    [`7. Fiber — ${FIBER_PER_1000_KCAL} g per 1000 kcal`,
      `${targets.calories} ÷ 1000 × ${FIBER_PER_1000_KCAL} = ${targets.fiber} g`],
  ];

  $('#formula').replaceChildren(
    el('ol', {}, stepsList.map(([title, ...lines]) => el('li', {}, [el('strong', { text: title.replace(/^\d+\.\s*/, '') }), ...lines.map((line) => el('code', { text: line }))]))),
    el('p', { className: 'muted', text: 'These are starting estimates. If your weight isn’t moving the way you want after 2–3 weeks, adjust calories by about 5–10%.' }),
  );
}

function setupProfileForm() {
  fillSelect($('#activity-select'), ACTIVITY_LEVELS);
  fillSelect($('#goal-select'), GOALS);

  $('#profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const profile = {
      weight: num(form, 'weight'),
      height: num(form, 'height'),
      age: num(form, 'age'),
      sex: form.elements.sex.value,
      activity: form.elements.activity.value,
      goal: form.elements.goal.value,
    };

    let error = '';
    if (!(profile.weight >= 20 && profile.weight <= 400)) error = 'Please enter a weight between 20 and 400 kg.';
    else if (!(profile.height >= 100 && profile.height <= 250)) error = 'Please enter a height between 100 and 250 cm.';
    else if (!(Number.isInteger(profile.age) && profile.age >= 13 && profile.age <= 110)) error = 'Please enter an age between 13 and 110.';
    $('#profile-error').textContent = error;
    if (error) return;

    store.saveProfile(profile);
    renderTargets(profile);
    toast('Profile saved');
    $('#targets-card').scrollIntoView({ behavior: 'smooth' });
  });
}

// ---------- Start ----------

const renderers = { today: renderToday, log: updateLogPreview, foods: renderFoods, profile: renderProfile };

setupLogForm();
setupProfileForm();
$('#food-search').addEventListener('input', renderFoods);
window.addEventListener('hashchange', showView);
// If the app stays open past midnight, refresh the dashboard when you come back to it.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#view-today').hidden) renderToday(); });
showView();
