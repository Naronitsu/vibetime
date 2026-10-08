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
    settings: { target: 8, workDays: [1, 2, 3, 4, 5], country: '', ptoTotal: 0, sickTotal: 0, limitMax: 4, limitMin: 4, quarterTarget: 0, theme: 'dark',
                start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), opening: 0 },
    days: {},
  };
}
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || defaults(); } catch { state = defaults(); }
state.settings = { ...defaults().settings, ...state.settings };
if (!Array.isArray(state.settings.workDays)) state.settings.workDays = [1, 2, 3, 4, 5];
if (state.settings.limit != null) { state.settings.limitMax = state.settings.limitMin = state.settings.limit; delete state.settings.limit; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

// ---- theme + navigation
const ICONS = {
  today: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  calendar: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  settings: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
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
  const links = [['index.html', 'Today', ICONS.today], ['calendar.html', 'Calendar', ICONS.calendar], ['settings.html', 'Settings', ICONS.settings]];
  document.getElementById('nav').outerHTML = `
    <aside class="side">
      <div class="brand">${BRAND}<span class="bt">Vibe<br>Time</span></div>
      <nav>${links.map(([h, t, i]) => `<a href="${h}" title="${t}" class="${h === page ? 'on' : ''}">${i}<span class="lbl">${t}</span></a>`).join('')}</nav>
      <button class="themebtn" id="theme" title="Switch between day and night"></button>
    </aside>`;
  document.getElementById('theme').onclick = () => {
    state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
    save(); applyTheme();
  };
  applyTheme();
}

// ---- public holidays
const _hol = {};
function holidayName(d) {
  const c = COUNTRIES[state.settings.country];
  if (!c) return null;
  const key = state.settings.country + d.getFullYear();
  if (!_hol[key]) _hol[key] = Object.fromEntries(c.holidays(d.getFullYear()).map(h => [h.date, h.name]));
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
// Balance = opening + deltas of logged days from the start date through `end` (inclusive).
function balanceThrough(end) {
  let b = Number(state.settings.opening) || 0;
  const e = fmt(end);
  for (const k in state.days) if (k >= state.settings.start && k <= e) b += deltaFor(parseDate(k));
  return b;
}
function monthDelta(y, m) {
  let s = 0;
  const prefix = `${y}-${pad(m+1)}-`;
  for (const k in state.days) if (k.startsWith(prefix) && k >= state.settings.start) s += deltaFor(parseDate(k));
  return s;
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
const cls = h => h > 1e-9 ? 'pos' : h < -1e-9 ? 'neg' : '';
const toInput = h => h == null ? '' : fh(h, false);

// Accepts "7h 45m", "7h45", "7 hours 45 min", "45m", "7:45", "7.75", "7,5". Returns null if empty, NaN if invalid.
function parseHours(v) {
  v = v.trim().toLowerCase().replace(',', '.');
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
// Older saves used { h, leave, type, lh }; convert them to { w, pto, sick }.
function migrateDays(days) {
  for (const k in days) {
    const e = days[k];
    if ('w' in e || 'pto' in e || 'sick' in e || !('h' in e || 'leave' in e)) continue;
    const n = {};
    if (!e.leave) n.w = e.h || 0;
    else {
      if (e.h) n.w = e.h;
      n[e.type || 'pto'] = e.lh != null ? e.lh : state.settings.target;
    }
    days[k] = n;
  }
}
migrateDays(state.days);

// Time-off usage for a calendar year, in days. Leave on non-working days or public holidays doesn't count.
function leaveStats(year) {
  const today = startOfToday();
  const out = {
    pto:  { total: Number(state.settings.ptoTotal) || 0,  taken: 0, upcoming: 0 },
    sick: { total: Number(state.settings.sickTotal) || 0, taken: 0, upcoming: 0 },
  };
  const T = state.settings.target || 1;
  for (const k in state.days) {
    const e = state.days[k], d = parseDate(k);
    if (d.getFullYear() !== year || expectedFor(d) === 0) continue;
    for (const t of ['pto', 'sick']) {
      const n = (e[t] || 0) / T; if (!n) continue;
      if (d <= today) out[t].taken += n; else out[t].upcoming += n;
    }
  }
  for (const t in out) { const x = out[t]; x.booked = x.taken + x.upcoming; x.remaining = x.total - x.booked; }
  return out;
}
const fd = n => String(+Number(n).toFixed(2));
const longDate = d => d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });
