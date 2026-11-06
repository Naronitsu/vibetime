// Reads the BambooHR timesheet that is on screen. It only looks at the page it is given and returns plain data;
// it never sends anything anywhere. Written against the "Timesheet" tab (class names starting with TimesheetSlat).
//
// Result: { period, days: [ { date: 'YYYY-MM-DD', today, worked, entries: [ { start, end, active } ], timeOff: [ { hours, kind, label } ] } ] }
//   worked  = the day total BambooHR shows, in hours (null if none)
//   entries = each clock-in / clock-out as 'HH:MM' (end is null while still clocked in)
//   kind    = 'pto' | 'sick' | 'holiday'
(function (root) {
  const text = (el, sel) => { const n = el.querySelector(sel); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const pad = n => String(n).padStart(2, '0');

  // "8h 05m" / "0h 33m" / "45m" -> hours
  function parseDuration(s) {
    const m = (s || '').match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
    if (!m || (!m[1] && !m[2])) return null;
    return (Number(m[1]) || 0) + (Number(m[2]) || 0) / 60;
  }
  // "9:05 AM" / "5:30 PM" / "17:30" -> "09:05" / "17:30"; "Now" -> null
  function parseClock(s) {
    const m = (s || '').match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
    if (!m) return null;
    let h = Number(m[1]); const min = Number(m[2]);
    if (m[3]) h = h % 12 + (/p/i.test(m[3]) ? 12 : 0);
    if (h > 23 || min > 59) return null;
    return `${pad(h)}:${pad(min)}`;
  }
  // "Oct 26" has no year, so take the year that puts the date closest to today
  function resolveDate(label, now) {
    const m = (label || '').match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/);
    if (!m) return null;
    const mon = MONTHS.indexOf(m[1].toLowerCase()), day = Number(m[2]);
    if (mon < 0 || day < 1 || day > 31) return null;
    let best = null;
    for (const y of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
      const d = new Date(y, mon, day);
      if (d.getMonth() !== mon) continue;
      if (!best || Math.abs(d - now) < Math.abs(best - now)) best = d;
    }
    return best ? `${best.getFullYear()}-${pad(best.getMonth() + 1)}-${pad(best.getDate())}` : null;
  }
  // "8 hours Vacation PTO" -> { hours: 8, label: 'Vacation PTO', kind: 'pto' }
  function parseTimeOff(s) {
    const m = (s || '').match(/^(\d+(?:\.\d+)?)\s*hours?\s+(.*)$/i);
    if (!m) return null;
    const label = m[2].trim();
    const kind = /sick/i.test(label) ? 'sick' : (/holiday/i.test(label) && !/vacation|pto/i.test(label)) ? 'holiday' : 'pto';
    return { hours: Number(m[1]), label: label.slice(0, 80), kind };
  }

  function parseTimesheet(doc, now = new Date()) {
    const days = [];
    for (const slat of doc.querySelectorAll('.TimesheetSlat')) {
      const date = resolveDate(text(slat, '.TimesheetSlat__dayDate'), now);
      if (!date) continue;
      const worked = parseDuration(text(slat, '.TimesheetSlat__dayTotal'));
      const entries = [...slat.querySelectorAll('.TimeEntry')].map(e => {
        const end = text(e, '.TimeEntry__end');
        return { start: parseClock(text(e, '.TimeEntry__start')), end: /now/i.test(end) ? null : parseClock(end), active: e.classList.contains('TimeEntry--active') || /now/i.test(end) };
      }).filter(e => e.start);
      const timeOff = [...slat.querySelectorAll('.TimesheetSlat__extraInfoItem')].map(n => parseTimeOff(n.textContent.replace(/\s+/g, ' ').trim())).filter(Boolean);
      days.push({ date, today: slat.classList.contains('TimesheetSlat--today'), worked, entries, timeOff });
    }
    const period = text(doc, '.TimesheetHeader__period');
    return { period, days };
  }

  root.VibeParse = { parseTimesheet, parseDuration, parseClock, resolveDate, parseTimeOff };
})(typeof globalThis !== 'undefined' ? globalThis : this);
