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
    if (!p.days.length && !(Array.isArray(p.balances) && p.balances.length)) return null;
    const days = [];
    for (const d of p.days) {
      if (!d || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || isNaN(parseDate(d.date))) continue;
      const entries = (Array.isArray(d.entries) ? d.entries : []).slice(0, 40)
        .filter(e => e && timeStr(e.start) && (e.end === null || timeStr(e.end))).map(e => ({ start: e.start, end: e.end }));
      const timeOff = (Array.isArray(d.timeOff) ? d.timeOff : []).slice(0, 6)
        .filter(t => t && num(t.hours, 24) && ['pto', 'sick', 'holiday'].includes(t.kind)).map(t => ({ hours: t.hours, kind: t.kind, label: String(t.label || '').slice(0, 80) }));
      days.push({ date: d.date, today: !!d.today, worked: num(d.worked, 24) ? d.worked : null, entries, timeOff });
    }
    const any = x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 100000;
    const balances = (Array.isArray(p.balances) ? p.balances : []).slice(0, 20)
      .filter(x => x && typeof x.name === 'string' && any(x.available) && any(x.scheduled) && any(x.usedYtd) && (x.unit === 'hours' || x.unit === 'days'))
      .map(x => ({ name: x.name.slice(0, 60), unit: x.unit, available: x.available, scheduled: x.scheduled, usedYtd: x.usedYtd }));
    return { period: String(p.period || '').slice(0, 60), days, balances };
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

  // ---- time-off balances. BambooHR says how much is left; VibeTime keeps a yearly allowance and counts what you booked,
  // so the allowance is set to (what is left) + (what VibeTime already has booked this year): its "left" then matches BambooHR.
  const KIND_LABEL = { pto: 'PTO', sick: 'Sick leave', none: 'Don\u2019t use' };
  const guessKind = name => /sick/i.test(name) ? 'sick' : (/vacation|annual|pto|holiday leave/i.test(name) && !/training|conference|special/i.test(name)) ? 'pto' : 'none';
  const bal = [];                                   // { b, sel }
  const toHours = (v, b) => b.unit === 'days' ? v * state.settings.target : v;
  function allowanceFor(kind, bookedNow) {
    const net = $('bnet') ? $('bnet').checked : true;
    let left = 0, any = false;
    for (const x of bal) if (x.sel.value === kind) { any = true; left += toHours(net ? x.b.available : x.b.available - x.b.scheduled, x.b); }
    if (!any) return null;
    return Math.max(0, left + bookedNow);
  }
  function updateBal() {
    for (const x of bal) {
      const kind = x.sel.value, el = x.note;
      if (kind === 'none') { el.textContent = 'not imported'; continue; }
      const booked = leaveStats(new Date().getFullYear())[kind].booked, total = allowanceFor(kind, booked);
      const cur = Number(state.settings[kind === 'pto' ? 'ptoTotal' : 'sickTotal']) || 0;
      el.textContent = `${KIND_LABEL[kind]} allowance ${fh(cur, false)} \u2192 ${fh(total, false)}, so VibeTime shows ${fh(total - booked, false)} left`;
    }
  }
  function renderBalances() {
    const box = $('bbal'); box.innerHTML = ''; bal.length = 0;
    if (!data.balances.length) { box.hidden = true; return; }
    box.hidden = false;
    const h = document.createElement('h3'); h.textContent = 'Time-off balances'; box.append(h);
    const net = document.createElement('label'); net.className = 'bchk bnetrow';
    const ncb = document.createElement('input'); ncb.type = 'checkbox'; ncb.checked = true; ncb.id = 'bnet';
    const nt = document.createElement('span'); nt.textContent = 'The \u201cavailable\u201d hours already have scheduled time off taken out. Untick this if your Time Off page shows them before scheduled days are subtracted.';
    net.append(ncb, nt); box.append(net); ncb.onchange = updateBal;
    const ul = document.createElement('ul'); ul.className = 'list';
    for (const b of data.balances) {
      const li = document.createElement('li'); li.className = 'bbalrow';
      const name = document.createElement('span'); name.className = 'd';
      name.textContent = b.name;
      const sel = document.createElement('select'); sel.className = 'inp'; sel.setAttribute('aria-label', `Use ${b.name} as`);
      for (const k of ['pto', 'sick', 'none']) { const o = document.createElement('option'); o.value = k; o.textContent = KIND_LABEL[k]; sel.append(o); }
      sel.value = guessKind(b.name);
      const unit = b.unit === 'days' ? 'd' : 'h';
      const nums = document.createElement('span'); nums.className = 'bnow';
      nums.textContent = `${b.available}${unit} available \u00b7 ${b.scheduled}${unit} scheduled \u00b7 ${b.usedYtd}${unit} used this year`;
      const note = document.createElement('span'); note.className = 'bnow';
      li.append(name, sel, nums, note); ul.append(li);
      bal.push({ b, sel, note }); sel.onchange = updateBal;
    }
    box.append(ul); updateBal();
  }

  // ---- automatic: your BambooHR clock. The extension reports each punch-in and punch-out as it happens.
  //   punch-in : your punch-in and today's breaks go into the leave planner, and the timer starts from your punch time
  //   punch-out: today's worked hours are set to BambooHR's total, and the timer stops
  // It can be switched off in Settings. Every change is backed up first and the toast has an Undo.
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  function cleanAuto(p) {
    if (!p || p.source !== 'bamboohr' || p.version !== 1 || !['in', 'out'].includes(p.kind) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return null;
    const entries = (Array.isArray(p.entries) ? p.entries : []).slice(0, 40)
      .filter(e => e && timeStr(e.start) && (e.end === null || timeStr(e.end))).map(e => ({ start: e.start, end: e.end }));
    if (!entries.length) return null;
    return { kind: p.kind, date: p.date, entries, worked: num(p.worked, 24) ? p.worked : null };
  }
  function toast(msg, undo) {
    let t = $('btoast');
    if (!t) { t = document.createElement('div'); t.id = 'btoast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg;
    if (undo) { const u = document.createElement('button'); u.type = 'button'; u.className = 'btn sm'; u.textContent = 'Undo'; u.onclick = undo; t.append(u); }
    t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 12000);
  }
  function undoLast() {
    const bk = readBackup(); if (!bk) return;
    try { state = migrateState(bk.state).data; save(); localStorage.removeItem(BACKUP_KEY); location.reload(); } catch {}
  }
  const finishAuto = () => window.postMessage({ vibetimeBambooDone: true }, location.origin);
  function applyAuto(raw) {
    const p = cleanAuto(raw);
    if (!p || state.settings.bambooAuto === false) return finishAuto();
    const today = fmt(new Date());
    if (p.kind === 'in' && p.date !== today) return finishAuto();
    const sorted = p.entries.slice().sort((x, y) => x.start.localeCompare(y.start));
    const closed = sorted.filter(e => e.end !== null), open = sorted.find(e => e.end === null);
    const doneH = closed.reduce((s, e) => s + Math.max(0, toMin(e.end) - toMin(e.start)), 0) / 60;
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) if (sorted[i - 1].end && sorted[i].start > sorted[i - 1].end) gaps.push(`${sorted[i - 1].end}-${sorted[i].start}`);
    let msg = '', changed = false;
    stashBackup();
    // the leave planner: punch-in time, and the breaks BambooHR shows as gaps between entries
    if (p.date === today) {
      let plan = null; try { plan = JSON.parse(localStorage.getItem('vibetime.punchin')); } catch {}
      if (!plan || plan.date !== today) plan = { date: today, time: '', breaks: [''], applied: null };
      plan.time = sorted[0].start; if (gaps.length) plan.breaks = gaps;
      try { localStorage.setItem('vibetime.punchin', JSON.stringify(plan)); } catch {}
    }
    const dayMs = parseDate(p.date).getTime();
    const cur = state.days[p.date] || {};
    if (p.kind === 'in') {
      if (doneH > 0 && mins(cur.w) !== mins(doneH)) { state.days[p.date] = { ...cur, w: doneH }; changed = true; }    // what BambooHR already counts for earlier entries
      if (open && !readTimer()) {
        try { localStorage.removeItem('vibetime.punched'); localStorage.setItem('vibetime.timer', JSON.stringify({ mode: 'run', since: dayMs + toMin(open.start) * 6e4, acc: 0 })); } catch {}
      }
      msg = `Punch-in ${clockLabel(open ? open.start : sorted[0].start)} read from BambooHR. Your timer is running from then.`;
    } else {
      const total = p.worked != null ? p.worked : doneH;
      state.days[p.date] = { ...cur, w: total }; changed = true;
      try { localStorage.removeItem('vibetime.timer'); localStorage.setItem('vibetime.punched', p.date); } catch {}
      msg = `Punched out: ${fh(total, false)} logged for today from BambooHR.`;
    }
    if (changed) save();
    // show it on the page if it is open
    if (typeof refresh === 'function' && typeof renderTimer === 'function') {
      refresh(); renderTimer();
      if (typeof renderBreaks === 'function' && $('punchIn')) { try { const pl = JSON.parse(localStorage.getItem('vibetime.punchin')); if (pl) $('punchIn').value = pl.time; $('breaks').innerHTML = ''; renderBreaks(); renderPlan(); } catch {} }
    }
    toast(msg, undoLast);
    finishAuto();
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
    $('blist').hidden = !data.days.length;
    renderBalances();
    const bits = [];
    if (data.days.length) bits.push(`${data.days.length} day${data.days.length === 1 ? '' : 's'} from your timesheet${data.period ? ` (${data.period})` : ''}`);
    if (data.balances.length) bits.push(`${data.balances.length} time-off balance${data.balances.length === 1 ? '' : 's'}`);
    $('bsum').textContent = `Read ${bits.join(' and ')}. Tick what to bring into VibeTime${data.days.length ? '; days that match what you already have are left unticked' : ''}.`;
  }

  function apply() {
    stashBackup();                                  // so Settings > Undo can bring back what you had
    let n = 0;
    for (const r of rows) if (r.cb.checked && r.p.changed) { if (Object.keys(r.p.next).length) state.days[r.d.date] = r.p.next; else delete state.days[r.d.date]; n++; }
    const tp = $('btoday')._tp, cb = $('btodaycb');
    if (tp && cb && cb.checked) {
      try { localStorage.setItem('vibetime.punchin', JSON.stringify({ date: fmt(new Date()), time: tp.time, breaks: tp.breaks.length ? tp.breaks : [''], applied: null })); } catch {}
    }
    for (const kind of ['pto', 'sick']) {
      const total = allowanceFor(kind, leaveStats(new Date().getFullYear())[kind].booked);
      if (total != null) { state.settings[kind === 'pto' ? 'ptoTotal' : 'sickTotal'] = Math.round(total * 100) / 100; n++; }
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
  window.addEventListener('message', ev => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    if (ev.data && ev.data.vibetimeBambooAuto) applyAuto(ev.data.vibetimeBambooAuto);
  });
  window.__vibetimeBambooOpen = open;               // used by the tests
});
