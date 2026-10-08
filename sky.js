// Star chart helpers, shared by the Stars page and the "this week" card on Today.
// A week is a constellation: one star per working day, in a random-looking but stable shape (seeded by the
// week), joined in order as the days are logged. Weeks belong to the month that holds their Thursday (ISO rule),
// so every week is a complete constellation and every day belongs to exactly one.

const SKY_ORDER = [1, 2, 3, 4, 5, 6, 0];            // Monday first
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); return addDays(m, -((m.getDay() + 6) % 7)); };
const weekNumber = monday => Math.round((monday - mondayOf(new Date(addDays(monday, 3).getFullYear(), 0, 4))) / (7 * 864e5)) + 1;
function weeksOfYear(Y) {
  const out = [];
  for (let m = mondayOf(new Date(Y, 0, 4)); addDays(m, 3).getFullYear() === Y; m = addDays(m, 7)) out.push(m);
  return out;
}
const weekDays = monday => SKY_ORDER.filter(wd => state.settings.workDays.includes(wd)).map(wd => addDays(monday, (wd + 6) % 7));

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// n points that wander left to right like a connect-the-dots, scaled to fill a w x h box.
function constellation(seed, n, w, h) {
  const rnd = mulberry32(seed), pad = 8, pts = [];
  if (!n) return pts;
  pts.push({ x: rnd() * w * 0.25, y: rnd() * h });
  while (pts.length < n) {
    const p = pts[pts.length - 1];
    let best = null;
    for (let t = 0; t < 40 && !best; t++) {
      const ang = (rnd() - 0.5) * 4.6, dist = (0.16 + rnd() * 0.26) * w;
      const c = { x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist * 0.9 };
      if (c.y < 0 || c.y > h) continue;
      if (pts.every(q => Math.hypot(q.x - c.x, q.y - c.y) > w * 0.12)) best = c;
    }
    pts.push(best || { x: p.x + w * 0.2, y: rnd() * h });
  }
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return pts.map(p => ({
    x: pad + (x1 === x0 ? 0.5 : (p.x - x0) / (x1 - x0)) * (w - 2 * pad),
    y: pad + (y1 === y0 ? 0.5 : (p.y - y0) / (y1 - y0)) * (h - 2 * pad),
  }));
}

// What a day's star looks like. `lit` stars are logged days and public holidays that have passed.
function starInfo(d) {
  const k = fmt(d), today = startOfToday(), e = state.days[k], exp = expectedFor(d), hol = holidayName(d);
  const info = { d, k, e, exp, hol, lit: false, kind: 'future', color: 'w', delta: 0 };
  if (e) {
    const parts = { w: e.w || 0, pto: exp > 0 ? e.pto || 0 : 0, sick: exp > 0 ? e.sick || 0 : 0 };
    info.parts = parts;
    info.color = Object.entries(parts).sort((a, b) => b[1] - a[1])[0][0];
    info.delta = creditedFor(e, d) - exp;
    if (d > today) info.kind = 'planned';
    else { info.kind = 'logged'; info.lit = true; info.perfect = exp > 0 && Math.abs(info.delta) <= 0.25; }
  } else if (hol && d <= today) { info.kind = 'holiday'; info.lit = true; info.color = 'h'; }
  else if (d > today) info.kind = 'future';
  else if (+d === +today) info.kind = 'today';
  else if (k < state.settings.start) info.kind = 'before';
  else info.kind = 'missing';
  return info;
}
function starTip(i) {
  const label = i.d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
  const bits = i.parts ? [['w', 'Worked'], ['pto', 'PTO'], ['sick', 'Sick']].filter(([key]) => i.parts[key] > 0).map(([key, n]) => `${n} ${fh(i.parts[key], false)}`) : [];
  switch (i.kind) {
    case 'logged': return `${label}: ${bits.length ? bits.join(', ') : '0h'} (${Math.abs(i.delta) < 1e-9 ? 'on target' : fh(i.delta)})`;
    case 'planned': return `${label}: booked ${bits.join(', ')}`;
    case 'holiday': return `${label}: ${i.hol}`;
    case 'today': return `${label}: today, not logged yet`;
    case 'missing': return `${label}: nothing logged`;
    case 'before': return `${label}: before tracking started`;
    default: return `${label}: upcoming${i.hol ? ' (' + i.hol + ')' : ''}`;
  }
}

// 4-point sparkle drawn at size r (coordinates baked in, so CSS can animate the wrapper without moving the star)
const sparkPath = r => { const q = n => f1(n * r); return `M0 ${q(-1)}C${q(.12)} ${q(-.3)} ${q(.3)} ${q(-.12)} ${q(1)} 0C${q(.3)} ${q(.12)} ${q(.12)} ${q(.3)} 0 ${q(1)}C${q(-.12)} ${q(.3)} ${q(-.3)} ${q(.12)} ${q(-1)} 0C${q(-.3)} ${q(-.12)} ${q(-.12)} ${q(-.3)} 0 ${q(-1)}Z`; };
const f1 = n => Math.round(n * 10) / 10;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function starSVG(i, x, y, n) {
  const col = i.kind === 'holiday' ? 'h' : i.color;
  const r = i.kind === 'logged' ? (i.delta > 0.25 ? 6 : i.delta < -0.25 ? 4.2 : 5) : 4;
  const cls = ['st', i.kind, 'c-' + col, i.perfect && 'perfect', i.delta > 0.25 && 'over'].filter(Boolean).join(' ');
  const shape = i.lit ? `<g transform="translate(${f1(x)} ${f1(y)})"><g class="tw"><path d="${sparkPath(r * 1.8)}"/></g></g>` : `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}"/>`;
  return `<g class="${cls}" data-k="${i.k}" data-tip="${esc(starTip(i))}" style="--d:${n * 90}ms"><circle class="hit" cx="${f1(x)}" cy="${f1(y)}" r="10"/>${shape}</g>`;
}

// One week as SVG markup positioned at (ox, oy) inside a w x h box.
function weekGroup(monday, ox, oy, w, h) {
  const days = weekDays(monday), n = days.length;
  const seed = addDays(monday, 3).getFullYear() * 100 + weekNumber(monday) + n * 100000;
  const pts = constellation(seed, n, w, h).map(p => ({ x: ox + p.x, y: oy + p.y }));
  const infos = days.map(starInfo);
  let s = '';
  for (let i = 1; i < n; i++) {
    const on = infos[i - 1].lit && infos[i].lit;
    s += `<path class="ln${on ? ' on' : ''}"${on ? ' pathLength="1"' : ''} d="M${f1(pts[i - 1].x)} ${f1(pts[i - 1].y)}L${f1(pts[i].x)} ${f1(pts[i].y)}" style="--d:${i * 140}ms"/>`;
  }
  infos.forEach((inf, i) => { s += starSVG(inf, pts[i].x, pts[i].y, i); });
  const lit = infos.filter(i => i.lit).length;
  return { svg: `<g class="wk${n && lit === n ? ' done' : ''}">${s}</g>`, pts, infos, lit, n, complete: n > 0 && lit === n };
}

// One month: its weeks laid out two across, snaking down, chained end to start.
function monthSVG(mondays) {
  const W = 330, H = 232, rnd = mulberry32(mondays.length ? mondays[0].getTime() / 864e5 | 0 : 1);
  let s = '', prev = null, lit = 0, total = 0, weeksDone = 0, perfect = 0;
  for (let i = 0; i < 30; i++) s += `<circle class="bg" cx="${f1(rnd() * W)}" cy="${f1(rnd() * H)}" r="${f1(0.5 + rnd() * 0.9)}"/>`;
  mondays.forEach((mon, i) => {
    const row = i >> 1, col = row % 2 === 0 ? i % 2 : 1 - (i % 2);
    const g = weekGroup(mon, 10 + col * 160 + 8, 14 + row * 72 + 8, 128, 46);
    if (prev && prev.n && g.n) {
      const a = prev.pts[prev.n - 1], b = g.pts[0], on = prev.infos[prev.n - 1].lit && g.infos[0].lit;
      s += `<path class="ln wkc${on ? ' on' : ''}" d="M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}"/>`;
    }
    s += g.svg;
    lit += g.lit; total += g.n; if (g.complete) weeksDone++;
    perfect += g.infos.filter(x => x.perfect).length;
    prev = g;
  });
  return { svg: `<svg class="monthsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Constellations for the month">${s}</svg>`, lit, total, weeksDone, weeks: mondays.length, perfect, complete: total > 0 && lit === total };
}
