// Shared data + calculation code for all pages.
const KEY = 'flexTimeTracker.v1';
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const isWorkday = d => state.settings.workDays.includes(d.getDay());
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

function defaults() {
  const now = new Date();
  return {
    settings: { target: 8, workDays: [1, 2, 3, 4, 5], country: '', region: '', ptoTotal: 0, sickTotal: 0, limitMax: 4, limitMin: 4, quarterTarget: 0, theme: 'dark',
                start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), opening: 0 },
    days: {},
    mod: {}, settingsMod: 0,           // when each day / the settings last changed (used to merge devices)
    version: SCHEMA,
  };
}

// ---------------------------------------------------------------------------------------------
// Data format. Everything saved in the browser AND everything exported/imported goes through
// migrateState(), so old data and old backup files keep working after updates.
//
//   { version, settings: {...}, days: { 'YYYY-MM-DD': { w, pto, sick } } }     (hours, all optional)
//
// To change the format later: bump SCHEMA and add MIGRATIONS[<old version>] that returns the data
// in the next version's shape. Never edit an existing migration. New settings only need a default
// in defaults() (and a rule in SETTING_RULES to validate them).
// ---------------------------------------------------------------------------------------------
const SCHEMA = 2;
const nonNeg = v => Number.isFinite(v) && v >= 0;
const SETTING_RULES = {
  target: v => Number.isFinite(v) && v > 0 && v <= 24,
  limitMax: nonNeg, limitMin: nonNeg, ptoTotal: nonNeg, sickTotal: nonNeg,
  quarterTarget: Number.isFinite, opening: Number.isFinite,
  start: v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
  workDays: v => Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 0 && n <= 6),
  country: v => typeof v === 'string', region: v => typeof v === 'string',
  theme: v => v === 'dark' || v === 'light',
};
const MIGRATIONS = {
  // 1 -> 2: one limit became max/min, allowances moved from days to hours, days became { w, pto, sick }.
  1(d) {
    const st = d.settings;
    if (st.limit != null) { st.limitMax = st.limitMin = st.limit; delete st.limit; }
    const T = Number(st.target) > 0 ? Number(st.target) : 8;
    if (st.allowanceUnit !== 'h') { st.ptoTotal = (Number(st.ptoTotal) || 0) * T; st.sickTotal = (Number(st.sickTotal) || 0) * T; }
    delete st.allowanceUnit;
    for (const k in d.days) {
      const e = d.days[k];
      if (!e || typeof e !== 'object' || 'w' in e || 'pto' in e || 'sick' in e || !('h' in e || 'leave' in e)) continue;
      const n = {};
      if (!e.leave) n.w = e.h || 0;
      else { if (e.h) n.w = e.h; n[e.type || 'pto'] = e.lh != null ? e.lh : T; }
      d.days[k] = n;
    }
    return d;
  },
};
// Turn any saved/imported data into the current format. Throws an Error with a readable message if
// it clearly isn't VibeTime data; otherwise repairs what it can and reports the rest in `warnings`.
function migrateState(raw) {
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(raw) || (raw.settings == null && raw.days == null)) throw new Error('This file is not a VibeTime backup.');
  if ((raw.settings != null && !isObj(raw.settings)) || (raw.days != null && !isObj(raw.days))) throw new Error('This backup is damaged (settings or days are not readable).');
  const warnings = [];
  let d = JSON.parse(JSON.stringify({ settings: raw.settings || {}, days: raw.days || {} }));
  let v = Number.isInteger(raw.version) && raw.version >= 1 ? raw.version : 1;
  const sourceVersion = v;
  if (v > SCHEMA) warnings.push(`This backup was made by a newer version of VibeTime (format ${v}). Anything this version doesn't understand is kept but ignored.`);
  for (; v < SCHEMA; v++) d = MIGRATIONS[v](d);

  const def = defaults().settings;
  for (const [key, ok] of Object.entries(SETTING_RULES)) {
    if (d.settings[key] === undefined) continue;
    if (!ok(d.settings[key])) { warnings.push(`The "${key}" setting was invalid and was reset to its default.`); delete d.settings[key]; }
  }
  d.settings = { ...def, ...d.settings };

  let skipped = 0;
  for (const k of Object.keys(d.days)) {
    const e = d.days[k];
    let good = /^\d{4}-\d{2}-\d{2}$/.test(k) && !isNaN(parseDate(k)) && e && typeof e === 'object' && !Array.isArray(e);
    if (good) {
      for (const f of ['w', 'pto', 'sick']) if (f in e && !nonNeg(e[f])) delete e[f];
      good = ['w', 'pto', 'sick'].some(f => f in e);
    }
    if (!good) { delete d.days[k]; skipped++; }
  }
  if (skipped) warnings.push(`${skipped} day entr${skipped === 1 ? 'y was' : 'ies were'} unreadable and skipped.`);
  d.mod = {};
  if (raw.mod && typeof raw.mod === 'object' && !Array.isArray(raw.mod)) for (const [k, t] of Object.entries(raw.mod)) if (Number.isFinite(t) && /^\d{4}-\d{2}-\d{2}$/.test(k)) d.mod[k] = t;
  d.settingsMod = Number.isFinite(raw.settingsMod) ? raw.settingsMod : 0;
  d.version = SCHEMA;
  return { data: d, warnings, sourceVersion };
}

let state;
try {
  const stored = localStorage.getItem(KEY);
  try { state = stored ? migrateState(JSON.parse(stored)).data : defaults(); }
  catch (err) {                       // unreadable saved data: keep a copy aside instead of overwriting it silently
    try { localStorage.setItem(KEY + '.corrupt', stored); } catch {}
    state = defaults();
  }
} catch { state = defaults(); }
// First visit: no saved data and the intro hasn't been seen, so go to the welcome page.
const WELCOME_KEY = 'vibetime.welcomed';
try {
  if (!localStorage.getItem(KEY) && !localStorage.getItem(WELCOME_KEY) && !/welcome\.html$/.test(location.pathname)) location.replace('welcome.html');
} catch {}
// Change tracking for device sync: every save notices which days (and whether the settings) changed since the last
// save and stamps them with the time, so two devices can later keep the newer version of each day. Theme is per device.
let _days, _set;
const settingsKey = () => { const { theme, ...rest } = state.settings; return JSON.stringify(rest); };
function snapshotState() { _days = Object.fromEntries(Object.entries(state.days).map(([k, e]) => [k, JSON.stringify(e)])); _set = settingsKey(); }
snapshotState();
function trackChanges() {
  const now = Date.now();
  if (!state.mod) state.mod = {};
  for (const [k, e] of Object.entries(state.days)) { const j = JSON.stringify(e); if (_days[k] !== j) { state.mod[k] = now; _days[k] = j; } }
  for (const k of Object.keys(_days)) if (!(k in state.days)) { state.mod[k] = now; delete _days[k]; }
  const sj = settingsKey(); if (sj !== _set) { state.settingsMod = now; _set = sj; }
}
const save = (track = true) => {
  if (track) trackChanges();
  state.version = SCHEMA;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  if (track && window.vtSyncSoon) vtSyncSoon();
};

// Backup file contents, and a safety copy of the current data taken before any import or erase.
const exportData = () => ({ app: 'vibetime', version: SCHEMA, exportedAt: new Date().toISOString(), settings: state.settings, days: state.days });
const BACKUP_KEY = KEY + '.backup';
function stashBackup() { try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), state })); } catch {} }
function readBackup() { try { return JSON.parse(localStorage.getItem(BACKUP_KEY)); } catch { return null; } }

// ---- theme + navigation
const ICONS = {
  today: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  calendar: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  settings: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  star: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l2.4 5.6 6.1.5-4.6 4 1.4 5.9L12 15.9 6.7 19l1.4-5.9-4.6-4 6.1-.5z"/></svg>',
  sun: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="ic" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>',
};
const BRAND = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <circle class="sunrays" cx="24" cy="24" r="21" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="3 6" stroke-linecap="round"/>
  <circle cx="24" cy="24" r="14" style="fill:var(--accent);stroke:var(--line)" stroke-width="3"/>
  <path d="M12 33 L21 19 L26 26 L30 21 L37 33 Z" style="fill:var(--m2);stroke:var(--line)" stroke-width="3" stroke-linejoin="round"/></svg>`;

function applyTheme() {
  const dark = state.settings.theme !== 'light';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const b = document.getElementById('theme');
  if (b) b.innerHTML = `${dark ? ICONS.sun : ICONS.moon}<span class="lbl">${dark ? 'Day mode' : 'Night mode'}</span>`;
}
applyTheme();

function renderNav(page) {
  const links = [['index.html', 'Today', ICONS.today], ['calendar.html', 'Calendar', ICONS.calendar], ['sky.html', 'Stars', ICONS.star], ['settings.html', 'Settings', ICONS.settings]];
  document.getElementById('nav').outerHTML = `
    <aside class="side">
      <div class="brand">${BRAND}<span class="bt">Vibe<br>Time</span></div>
      <nav>${links.map(([h, t, i]) => `<a href="${h}" title="${t}" class="${h === page ? 'on' : ''}">${i}<span class="lbl">${t}</span></a>`).join('')}</nav>
      <button class="syncchip" id="syncchip" hidden title="Sync is paused. Tap to sign in to Google again.">Sync paused<small>tap to sign in</small></button>
      <button class="themebtn" id="theme" title="Switch between day and night"></button>
    </aside>`;
  document.getElementById('theme').onclick = () => {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    save(); applyTheme();
  };
  applyTheme();
  document.getElementById('syncchip').onclick = () => window.syncNow && syncNow(false, true);
}

// ---- public holidays (data and loading live in holidays.js)
const _hol = {};
function holidayName(d) {
  const cc = state.settings.country;
  if (!cc) return null;
  const y = d.getFullYear(), key = `${cc}|${state.settings.region}|${y}`;
  if (!_hol[key]) {
    const list = holidayList(cc, state.settings.region, y);
    if (!list) return null;                       // still loading; pages re-render on 'holidays-updated'
    _hol[key] = Object.fromEntries(list.map(h => [h.date, h.name]));
  }
  return _hol[key][fmt(d)] || null;
}
function upcomingHolidays(n = 5) {
  const out = [], d = startOfToday();
  for (let i = 0; i < 400 && out.length < n; i++, d.setDate(d.getDate() + 1)) {
    const name = holidayName(d);
    if (name) out.push({ date: new Date(d), name });
  }
  return out;
}
prefetchHolidays(state.settings.country);

// ---- weather: how your balance looks measured against the monthly limit
function weather(bal) {
  const { limitMax, limitMin } = state.settings;
  const lim = bal >= 0 ? limitMax : limitMin;
  const r = lim > 0 ? Math.abs(bal) / lim : (Math.abs(bal) < 0.01 ? 0 : 9);
  const x = fh(Math.abs(bal), false);
  if (r < 0.15) return { key: 'clear', title: 'Clear skies', text: 'Right on target.' };
  if (bal < 0) {
    if (r <= 0.5) return { key: 'cloudy', title: 'Clouds rolling in', text: `${x} short of target.` };
    if (r <= 1) return { key: 'showers', title: 'Showers', text: `${x} short. Getting close to the monthly limit.` };
    return { key: 'storm', title: 'Storm', text: `${x} short. Outside the monthly limit.` };
  }
  if (r <= 1) return { key: 'warm', title: 'Warm and sunny', text: `${x} extra banked.` };
  return { key: 'heat', title: 'Heatwave', text: `${x} extra. Outside the monthly limit.` };
}

// ---- calculations
// A day entry is { w, pto, sick }: hours worked, PTO hours and sick-leave hours, each optional and independent.
// Hours expected on day `d`: the daily target on working days that aren't public holidays.
function expectedFor(d) {
  return (!isWorkday(d) || holidayName(d)) ? 0 : state.settings.target;
}
const targetFor = expectedFor;
// Hours credited for an entry: worked + leave (leave only counts on days where hours are expected).
const creditedFor = (e, d) => (e.w || 0) + (expectedFor(d) > 0 ? (e.pto || 0) + (e.sick || 0) : 0);
const deltaFor = d => {
  const e = state.days[fmt(d)];
  return e ? creditedFor(e, d) - expectedFor(d) : 0;
};
// What one calendar day adds to the balance. A logged day adds (credited - expected). A working day in the past that was
// never logged counts as 0h worked, so it adds -expected. Today and future days add nothing until something is logged.
function dayDelta(d, today) {
  const e = state.days[fmt(d)];
  if (e) return creditedFor(e, d) - expectedFor(d);
  return d < today ? -expectedFor(d) : 0;
}
// Balance = opening + every day from the tracking start date through `end` (inclusive).
function balanceThrough(end) {
  let b = Number(state.settings.opening) || 0;
  const today = startOfToday();
  for (const d = parseDate(state.settings.start); d <= end; d.setDate(d.getDate() + 1)) b += dayDelta(d, today);
  return b;
}
function monthDelta(y, m) {
  let s = 0;
  const today = startOfToday(), start = parseDate(state.settings.start);
  for (let d = new Date(y, m, 1); d.getMonth() === m; d.setDate(d.getDate() + 1)) if (d >= start) s += dayDelta(d, today);
  return s;
}
// Hours for one month, counting only days from the tracking start: how many are expected, and how many are credited,
// split by kind. A public holiday on a working day counts as a day of PTO (credited and expected) without using up the allowance.
function monthTotals(y, m) {
  const start = parseDate(state.settings.start), out = { expected: 0, w: 0, pto: 0, sick: 0 };
  for (const d = new Date(y, m, 1); d.getMonth() === m; d.setDate(d.getDate() + 1)) {
    if (d < start) continue;
    const e = state.days[fmt(d)] || {}, exp = expectedFor(d);
    out.expected += exp; out.w += e.w || 0;
    if (exp > 0) { out.pto += e.pto || 0; out.sick += e.sick || 0; }
    else if (isWorkday(d) && holidayName(d)) { out.pto += state.settings.target; out.expected += state.settings.target; }
  }
  out.total = out.w + out.pto + out.sick;
  return out;
}
const quarterEnd = d => new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3 + 3, 0);
const monthEnd = d => new Date(d.getFullYear(), d.getMonth()+1, 0);

function stats() {
  const today = startOfToday();
  const { target, limitMax, limitMin, quarterTarget } = state.settings;
  const bal = balanceThrough(today);
  const qEnd = quarterEnd(today);
  // Remaining workdays in the quarter: today (if not logged yet) through quarter end, minus leave days.
  let remaining = 0;
  for (let d = new Date(today); d <= qEnd; d.setDate(d.getDate()+1)) {
    const e = state.days[fmt(d)];
    if (+d === +today && e) continue;
    const need = Math.max(0, expectedFor(d) - (e ? creditedFor(e, d) : 0));
    remaining += state.settings.target ? need / state.settings.target : 0;
  }
  const gap = bal - quarterTarget;               // hours to take back (+) or make up (-)
  const needAvg = remaining ? target - gap / remaining : null;
  const span = (limitMax + limitMin) || 1;
  return {
    today, bal, qEnd, remaining, gap, needAvg,
    mDelta: monthDelta(today.getFullYear(), today.getMonth()),
    within: bal <= limitMax + 1e-9 && bal >= -limitMin - 1e-9,
    daysToQ: Math.round((qEnd - today) / 864e5),
    pct: Math.max(0, Math.min(100, (bal + limitMin) / span * 100)),
    zero: limitMin / span * 100,
  };
}
// Past workdays since the start date with nothing logged (newest first).
function missingDays(max = 14) {
  const out = [], today = startOfToday();
  for (let d = new Date(today); fmt(d) >= state.settings.start && out.length < max; d.setDate(d.getDate()-1)) {
    if (+d !== +today && isWorkday(d) && !holidayName(d) && !state.days[fmt(d)]) out.push(new Date(d));
  }
  return out;
}

// ---- formatting / parsing
const fh = (h, sign = true) => {
  const neg = h < -1e-9, a = Math.abs(h), hh = Math.floor(a + 1e-9), mm = Math.round((a - hh) * 60);
  const [H, M] = mm === 60 ? [hh+1, 0] : [hh, mm];
  const s = H === 0 && M ? `${M}m` : `${H}h${M ? ' ' + pad(M) + 'm' : ''}`;
  return (neg ? '−' : (sign && a > 1e-9 ? '+' : '')) + s;
};
// like fh(), but with the h / m units set smaller (for big numbers). Output is HTML.
const fhUnits = (h, sign = true) => fh(h, sign).replace(/(\d)(h|m)/g, '$1<span class="u">$2</span>');
const cls = h => h > 1e-9 ? 'pos' : h < -1e-9 ? 'neg' : '';
const toInput = h => h == null ? '' : fh(h, false);

// Time slots: "8:00-12:00, 13:00-15:00" (also "9am - 5pm", "8-12", "22:00-02:00"). Returns the total hours, or NaN.
const SLOT = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/;
function parseSlots(v) {
  let mins = 0;
  for (const part of v.split(/[,;\n+&]|\band\b/)) {
    const m = part.trim().match(SLOT); if (!m) return NaN;
    const at = (h, mi, ap) => {
      h = Number(h); mi = Number(mi || 0);
      if (mi > 59 || h > 24 || (ap && (h < 1 || h > 12))) return NaN;
      if (ap) h = h % 12 + (ap === 'pm' ? 12 : 0);
      return h * 60 + mi;
    };
    const a = at(m[1], m[2], m[3]), b = at(m[4], m[5], m[6]);
    if (Number.isNaN(a) || Number.isNaN(b) || a === b) return NaN;
    mins += b > a ? b - a : b + 1440 - a;       // an end before the start means past midnight
  }
  return mins / 60;
}

// Accepts "7h 45m", "7h45", "7 hours 45 min", "45m", "7:45", "7.75", "7,5", or time slots like "8:00-12:00, 13:00-15:00".
// Returns null if empty, NaN if invalid.
function parseHours(v) {
  v = v.trim().toLowerCase();
  if (/\d\s*(?:am|pm)?\s*(?:-|–|—|to)\s*\d/.test(v)) return parseSlots(v);
  v = v.replace(',', '.');
  if (!v) return null;
  if (/^\d+:\d{1,2}$/.test(v)) { const [h, m] = v.split(':').map(Number); return h + m/60; }
  if (/^\d*\.?\d+$/.test(v)) return Number(v);
  const m = v.match(/^(?:(\d*\.?\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*(?:m(?:in(?:ute)?s?)?)?)?$/);
  if (m && (m[1] || m[2])) return (Number(m[1]) || 0) + (Number(m[2]) || 0) / 60;
  return NaN;
}

// ---- mutations
// Store a day's amounts (hours; null/undefined = not set). No amounts at all removes the entry.
function setEntry(k, { w = null, pto = null, sick = null } = {}) {
  const e = {};
  if (w != null) e.w = w;
  if (pto != null) e.pto = pto;
  if (sick != null) e.sick = sick;
  if (Object.keys(e).length) state.days[k] = e; else delete state.days[k];
  save();
}
// Set (or clear, with hours <= 0) one kind of leave on a day, keeping whatever else is logged there.
function setLeave(k, type, hours, persist = true) {
  const e = { ...(state.days[k] || {}) };
  if (hours > 0) e[type] = hours; else delete e[type];
  if (Object.keys(e).length) state.days[k] = e; else delete state.days[k];
  if (persist) save();
}
const LEAVE_NAME = { pto: 'PTO', sick: 'Sick leave' };
// Time-off usage for a calendar year, in hours. Leave on non-working days or public holidays doesn't count.
function leaveStats(year) {
  const today = startOfToday();
  const out = {
    pto:  { total: Number(state.settings.ptoTotal) || 0,  taken: 0, upcoming: 0 },
    sick: { total: Number(state.settings.sickTotal) || 0, taken: 0, upcoming: 0 },
  };
  for (const k in state.days) {
    const e = state.days[k], d = parseDate(k);
    if (d.getFullYear() !== year || expectedFor(d) === 0) continue;
    for (const t of ['pto', 'sick']) {
      const n = e[t] || 0; if (!n) continue;
      if (d <= today) out[t].taken += n; else out[t].upcoming += n;
    }
  }
  for (const t in out) { const x = out[t]; x.booked = x.taken + x.upcoming; x.remaining = x.total - x.booked; }
  return out;
}
const fd = n => String(+Number(n).toFixed(2));
const longDate = d => d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });
