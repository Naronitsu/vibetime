// The work timer, shared by every page. It lives in localStorage, so it keeps running across pages and reloads.
//   play  -> { mode: 'run',   since, acc }   (acc = milliseconds banked before this run)
//   pause -> { mode: 'pause', since, acc }
//   stop  -> adds the time to today's worked hours and removes the timer
// Needs app.js (state, setEntry, fmt, fh, pad).
const TIMER_KEY = 'vibetime.timer', PUNCH_KEY = 'vibetime.punched';
const readTimer = () => { try { const t = JSON.parse(localStorage.getItem(TIMER_KEY)); return t && t.mode ? t : null; } catch { return null; } };
const writeTimer = t => { try { t ? localStorage.setItem(TIMER_KEY, JSON.stringify(t)) : localStorage.removeItem(TIMER_KEY); } catch {} };
const timerMs = t => t ? t.acc + (t.mode === 'run' ? Date.now() - t.since : 0) : 0;
const clock = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; };
const TI = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13M16 5.5v13"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
};

// What the hiker should be doing: hiking while it runs, snacking on a pause, asleep for the rest of the day after a stop.
function campState() {
  const t = readTimer();
  if (t) return t.mode === 'run' ? 'hike' : 'break';
  try { if (localStorage.getItem(PUNCH_KEY) === fmt(new Date())) return 'rest'; } catch {}
  return 'view';
}

// Do one timer action: 'start' | 'pause' | 'resume' | 'stop'. Returns { note, logged, cancelled }.
function timerAct(action) {
  const t = readTimer(), now = Date.now(), out = { note: '', logged: 0, cancelled: false };
  if (action === 'stop') {
    const hrs = Math.round(timerMs(t) / 60000) / 60;
    if (hrs > 16 && !confirm(`The timer ran for ${fh(hrs, false)}. Log all of it to today?`)) { out.cancelled = true; return out; }
    writeTimer(null);
    if (hrs <= 0) { out.note = 'Under a minute, nothing logged'; return out; }
    try { localStorage.setItem(PUNCH_KEY, fmt(new Date())); } catch {}
    const today = fmt(new Date()), e = state.days[today] || {};
    setEntry(today, { ...e, w: (e.w || 0) + hrs });
    out.logged = hrs;
    return out;
  }
  try { localStorage.removeItem(PUNCH_KEY); } catch {}
  if (action === 'start') writeTimer({ mode: 'run', since: now, acc: 0 });
  else if (action === 'pause') writeTimer({ mode: 'pause', since: now, acc: timerMs(t) });
  else if (action === 'resume') writeTimer({ mode: 'run', since: now, acc: t.acc });
  return out;
}
