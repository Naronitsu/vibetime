// Import from BambooHR: the VibeTime for BambooHR browser extension opens this page at "#bamboo" and hands over the days it
// read from your timesheet. Nothing is saved until you have seen the preview and pressed Import.
// Needs app.js (state, save, fmt, fh) and the dialog markup in index.html.
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const dlg = $('bdlg');
  if (!dlg) return;

  // ---- check what came in (it is data from another page, so never trust its shape)
  const num = (x, max) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
  const timeStr = x => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
  function clean(p) {
    if (!p || p.source !== 'bamboohr' || p.version !== 1 || !Array.isArray(p.days) || p.days.length > 400) return null;
    const days = [];
    for (const d of p.days) {
      if (!d || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || isNaN(parseDate(d.date))) continue;
      const entries = (Array.isArray(d.entries) ? d.entries : []).slice(0, 40)
        .filter(e => e && timeStr(e.start) && (e.end === null || timeStr(e.end))).map(e => ({ start: e.start, end: e.end }));
      const timeOff = (Array.isArray(d.timeOff) ? d.timeOff : []).slice(0, 6)
        .filter(t => t && num(t.hours, 24) && ['pto', 'sick', 'holiday'].includes(t.kind)).map(t => ({ hours: t.hours, kind: t.kind, label: String(t.label || '').slice(0, 80) }));
      days.push({ date: d.date, today: !!d.today, worked: num(d.worked, 24) ? d.worked : null, entries, timeOff });
    }
    return { period: String(p.period || '').slice(0, 60), days };
  }

  // ---- what is already in VibeTime for a day, and what the import would change
  const mins = h => Math.round((h || 0) * 60);
  function plan(day) {
    const cur = state.days[day.date] || {}, next = { ...cur }, notes = [];
    if (day.worked != null && day.worked > 0) next.w = day.worked;
    for (const t of day.timeOff) if (t.kind !== 'holiday' && t.hours > 0) next[t.kind] = t.hours;   // holidays come from your country setting
    for (const k of ['w', 'pto', 'sick']) if (!(next[k] > 0)) delete next[k];
    const changed = ['w', 'pto', 'sick'].some(k => mins(next[k]) !== mins(cur[k]));
    const had = ['w', 'pto', 'sick'].filter(k => mins(cur[k]) && mins(cur[k]) !== mins(next[k]));
    return { cur, next, changed, replaces: had.length > 0 };
  }
  const part = (e) => ['w', 'pto', 'sick'].filter(k => e[k] > 0).map(k => `${k === 'w' ? '' : (k === 'pto' ? 'PTO ' : 'Sick ')}${fh(e[k], false)}`).join(' + ') || 'nothing';
  const dayLabel = date => parseDate(date).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
  const clockLabel = hhmm => { const [h, m] = hhmm.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

  // today's punch-in and the breaks between today's clock entries, for the leave-time planner
  function todayPlan(day) {
    const e = day.entries.filter(x => x.start).sort((a, b) => a.start.localeCompare(b.start));
    if (!e.length) return null;
    const breaks = [];
    for (let i = 1; i < e.length; i++) {
      const from = e[i - 1].end, to = e[i].start;
      if (from && to && to > from) breaks.push(`${from}-${to}`);       // a gap between two entries is a break
    }
    return { time: e[0].start, breaks, running: e.some(x => x.end === null) };
  }

  let data = null;
  const rows = [];
  function render() {
    const list = $('blist'); list.innerHTML = '';
    rows.length = 0;
    const todayK = fmt(new Date());
    const past = data.days.filter(d => !d.today && d.date !== todayK && (d.worked > 0 || d.timeOff.some(t => t.kind !== 'holiday')));
    for (const d of past) {
      const p = plan(d);
      const li = document.createElement('li');
      const label = document.createElement('label'); label.className = 'bchk';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = p.changed;
      const when = document.createElement('span'); when.className = 'd'; when.textContent = dayLabel(d.date);
      const will = document.createElement('b'); will.className = 'tab'; will.textContent = part(p.next);
      label.append(cb, when);
      const now = document.createElement('span'); now.className = 'bnow';
      now.textContent = !p.changed ? 'already the same' : p.replaces ? `replaces ${part(p.cur)}` : 'new';
      li.append(label, will, now);
      if (!isWorkday(parseDate(d.date)) && d.worked > 0) { const w = document.createElement('em'); w.className = 'muted'; w.textContent = 'not one of your working days'; li.append(w); }
      list.append(li);
      rows.push({ d, p, cb });
    }
    if (!past.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No finished days with hours or time off were found.'; list.append(li); }
    // today
    const box = $('btoday'); box.innerHTML = '';
    const td = data.days.find(d => d.today || d.date === todayK);
    const tp = td && todayPlan(td);
    if (tp) {
      const label = document.createElement('label'); label.className = 'bchk btoday';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.id = 'btodaycb';
      const t = document.createElement('span');
      t.textContent = `Today: use your punch-in (${clockLabel(tp.time)})${tp.breaks.length ? ` and ${tp.breaks.length} break${tp.breaks.length === 1 ? '' : 's'}` : ''} in the leave planner${tp.running ? ' (you are still clocked in, so today’s hours are not logged)' : ''}.`;
      label.append(cb, t); box.append(label);
      box._tp = tp;
    } else box._tp = null;
    const n = rows.length;
    $('bsum').textContent = `Read ${data.days.length} day${data.days.length === 1 ? '' : 's'} from your timesheet${data.period ? ` (${data.period})` : ''}. Tick the days to bring into VibeTime. Days that match what you already have are left unticked.`;
  }

  function apply() {
    stashBackup();                                  // so Settings > Undo can bring back what you had
    let n = 0;
    for (const r of rows) if (r.cb.checked && r.p.changed) { if (Object.keys(r.p.next).length) state.days[r.d.date] = r.p.next; else delete state.days[r.d.date]; n++; }
    const tp = $('btoday')._tp, cb = $('btodaycb');
    if (tp && cb && cb.checked) {
      try { localStorage.setItem('vibetime.punchin', JSON.stringify({ date: fmt(new Date()), time: tp.time, breaks: tp.breaks.length ? tp.breaks : [''], applied: null })); } catch {}
    }
    if (n) save();
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }

  function open(payload) {
    data = clean(payload);
    if (!data) return;
    render();
    dlg.showModal();
  }
  $('bgo').onclick = apply;
  $('bcancel').onclick = () => { dlg.close(); history.replaceState(null, '', location.pathname + location.search); };
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });

  // The extension's script on this page posts the days here. Only accept it when this page was opened for an import.
  window.addEventListener('message', ev => {
    if (ev.source !== window || ev.origin !== location.origin || location.hash !== '#bamboo') return;
    if (ev.data && ev.data.vibetimeBamboo) open(ev.data.vibetimeBamboo);
  });
  window.__vibetimeBambooOpen = open;               // used by the tests
});
