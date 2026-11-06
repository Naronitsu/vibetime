// Watches your BambooHR clock. It reports two things, and only these:
//   - you clocked IN  (or the page loaded while you are clocked in): your punch-in time and today's entries so far
//   - you clocked OUT: that day's entries and total
// It reads two places: the "My Time" widget on the Home page, and today's row on the Timesheet tab.
// It never clicks anything and never changes anything in BambooHR.
(function (root) {
  const P = root.VibeParse;
  const pad = n => String(n).padStart(2, '0');
  const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // ---- Timesheet tab: today's row has every entry, and an entry that runs to "Now" while you are clocked in
  function readTimesheet(doc, now) {
    const day = P.parseTimesheet(doc, now).days.find(d => d.today);
    if (!day) return null;
    return { source: 'timesheet', state: day.entries.some(e => e.end === null) ? 'in' : 'out', total: day.worked, entries: day.entries, date: day.date };
  }

  // ---- Home page: the "My Time" widget shows a Clock Out button and "Clocked In: Today at 9:25 AM" while you are in
  function readHome(doc, now) {
    const outBtn = doc.querySelector('[data-bi-id="my-time-widget-clock-out-button"]');
    const inBtn = doc.querySelector('[data-bi-id="my-time-widget-clock-in-button"]');
    // the clocked-in time, from the widget text
    let openStart = null;
    for (const p of doc.querySelectorAll('p')) {
      const m = txt(p).match(/^Clocked In:\s*(?:Today at\s*)?(\d{1,2}:\d{2}\s*[AaPp][Mm]?)$/i);
      if (m) { openStart = P.parseClock(m[1]); break; }
    }
    const state = (outBtn || openStart) ? 'in' : inBtn ? 'out' : null;
    if (!state) return null;
    // "Today 4h 10m" in the summary under the widget
    let total = null;
    for (const d of doc.querySelectorAll('[data-testid="time-tracking-summary-detail"]')) {
      if (/^today$/i.test(txt(d.querySelector('h6')))) { total = P.parseDuration(txt(d.querySelector('strong'))); break; }
    }
    return { source: 'home', state, openStart, total, date: dateStr(now) };
  }

  function createMonitor({ doc = document, now = () => new Date(), emit, settleMs = 5000, pollMs = 400 }) {
    let prev = null;                // 'in' | 'out' | null
    let entries = null;             // today's entries as we know them (Home page only)
    let initial = true;
    const clockData = P.parseClockData(doc);
    if (clockData && clockData.date === dateStr(now())) entries = clockData.entries.map(e => ({ ...e }));

    function read() { return readTimesheet(doc, now()) || readHome(doc, now()); }
    function entriesFor(cur) {
      if (cur.entries) return cur.entries.map(e => ({ ...e }));
      const list = (entries || []).map(e => ({ ...e }));
      if (cur.state === 'in' && cur.openStart && !list.some(e => e.end === null)) list.push({ start: cur.openStart, end: null });
      if (cur.state === 'in' && cur.openStart) { const o = list.find(e => e.end === null); if (o) o.start = cur.openStart; }
      return list;
    }
    function remember(cur, list) { if (cur.source === 'home') entries = list; }

    // after a clock-out, BambooHR needs a moment to update its totals: wait until the number stops changing
    function settle(first, done) {
      const t0 = Date.now(); let last = first.total, still = 0;
      const step = () => {
        const cur = read();
        if (!cur || cur.state !== 'out') return;                       // clocked straight back in: nothing to report
        if (cur.total !== null && cur.total === last) still++; else { still = 0; last = cur.total; }
        if (still >= 2 || Date.now() - t0 > settleMs) done(cur); else setTimeout(step, pollMs);
      };
      setTimeout(step, pollMs);
    }

    function tick() {
      const cur = read(); if (!cur) return;
      if (cur.state === prev) return;
      const before = prev; prev = cur.state;
      if (cur.state === 'in') {
        const list = entriesFor(cur); remember(cur, list);
        if (list.length) emit({ kind: 'in', date: cur.date, entries: list, worked: null, initial: before === null });
      } else if (before === 'in') {                                    // a real clock-out (not just the page loading)
        const list = (cur.source === 'home' ? (entries || []) : (cur.entries || [])).map(e => ({ ...e }));
        const open = list.find(e => e.end === null);
        if (open) open.end = hhmm(now());                              // the entry that just ended
        settle(cur, final => {
          const done = final.entries ? final.entries.map(e => ({ ...e })) : list;
          remember(final, done);
          emit({ kind: 'out', date: final.date, entries: done, worked: final.total, initial: false });
        });
      }
      initial = false;
    }
    return { tick, read };
  }

  root.VibeClock = { createMonitor, readHome, readTimesheet };
})(typeof globalThis !== 'undefined' ? globalThis : this);
