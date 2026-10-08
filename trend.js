// Balance trajectory: your running balance across the current quarter, drawn against the monthly limit
// corridor, with a dotted projection (what's already booked) and a dashed path to the quarter-end target.

const quarterStart = d => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
const tAdd = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayLabel2 = d => d.toLocaleDateString('en', { day: 'numeric', month: 'short' });

function niceStep(raw) { return [0.5, 1, 2, 4, 5, 10, 20, 25, 50, 100].find(s => s >= raw) || 100; }

function trendSeries() {
  const today = startOfToday(), qs = quarterStart(today), qe = quarterEnd(today);
  const N = Math.round((qe - qs) / 864e5) + 1;
  const start = tAdd(qs, -1);
  const hist = [{ k: 0, y: balanceThrough(start), d: start }];
  for (let k = 0; k < N; k++) {
    const d = tAdd(qs, k); if (d > today) break;
    hist.push({ k: k + 1, y: balanceThrough(d), d });
  }
  const last = hist[hist.length - 1];
  const proj = [{ ...last }];
  let run = last.y;
  for (let k = last.k; k < N; k++) {
    const d = tAdd(qs, k); run += deltaFor(d);   // only days with something already logged or booked change the balance
    proj.push({ k: k + 1, y: run, d, proj: true });
  }
  return { today, qs, qe, N, hist, proj, last };
}

function trendChart(uid) {
  const S = trendSeries(), { limitMax, limitMin, quarterTarget } = state.settings;
  const W = 440, H = 290, L = 42, R = 16, T = 16, B = 30, pw = W - L - R, ph = H - T - B;
  const vals = [...S.hist.map(p => p.y), ...S.proj.map(p => p.y), limitMax, -limitMin, quarterTarget, 0];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(1, (hi - lo) * 0.14); lo -= pad; hi += pad;
  const step = niceStep((hi - lo) / 5);
  const X = k => L + (k / S.N) * pw, Y = v => T + ((hi - v) / (hi - lo)) * ph;
  const f = n => Math.round(n * 10) / 10;
  const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${f(X(p.k))} ${f(Y(p.y))}`).join('');

  let g = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="ax" x="${L - 7}" y="${f(Y(v)) + 4}" text-anchor="end">${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}h</text>`;

  // month ends inside the quarter
  const marks = [];
  for (let m = 0; m < 3; m++) {
    const me = monthEnd(new Date(S.qs.getFullYear(), S.qs.getMonth() + m, 1));
    const k = Math.round((me - S.qs) / 864e5) + 1;
    const pt = (me <= S.today ? S.hist : S.proj).find(p => p.k === k) || S.proj[S.proj.length - 1];
    marks.push({ me, k, y: pt.y, past: me <= S.today, ok: pt.y <= limitMax + 1e-9 && pt.y >= -limitMin - 1e-9, last: m === 2 });
  }
  const mk = marks.map(m => `<line class="me" x1="${f(X(m.k))}" x2="${f(X(m.k))}" y1="${T}" y2="${T + ph}"/>
    <text class="ax" x="${f(X(m.k))}" y="${H - 9}" text-anchor="${m.last ? 'end' : 'middle'}">${dayLabel2(m.me)}</text>
    <circle class="mdot ${m.ok ? 'ok' : 'bad'}${m.past ? '' : ' future'}" cx="${f(X(m.k))}" cy="${f(Y(m.y))}" r="4.5"/>`).join('');

  const outRects = `<rect x="${L}" y="${T}" width="${pw}" height="${Math.max(0, Y(limitMax) - T)}"/><rect x="${L}" y="${f(Y(-limitMin))}" width="${pw}" height="${Math.max(0, T + ph - Y(-limitMin))}"/>`;
  const gap = S.last.y - quarterTarget;
  const glide = Math.abs(gap) > 0.01 && S.last.k < S.N ? `<path class="glide" d="M${f(X(S.last.k))} ${f(Y(S.last.y))}L${f(X(S.N))} ${f(Y(quarterTarget))}"/>` : '';
  const tx = f(X(S.last.k)), ty = f(Y(S.last.y));
  const bx = Math.min(Math.max(tx, L + 36), W - R - 36);

  const svg = `<svg class="trendsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balance over the quarter: now ${fh(S.last.y)}, limit corridor ${fh(-limitMin, false)} to ${fh(limitMax)}">
    <defs><clipPath id="out-${uid}">${outRects}</clipPath></defs>
    ${g}
    <rect class="corr" x="${L}" y="${f(Y(limitMax))}" width="${pw}" height="${f(Y(-limitMin) - Y(limitMax))}"/>
    <text class="ax lim" x="${W - R - 3}" y="${f(Y(limitMax)) + 12}" text-anchor="end">limit +${limitMax}h</text>
    <text class="ax lim" x="${W - R - 3}" y="${f(Y(-limitMin)) - 5}" text-anchor="end">limit −${limitMin}h</text>
    <line class="tgt" x1="${L}" x2="${W - R}" y1="${f(Y(quarterTarget))}" y2="${f(Y(quarterTarget))}"/>
    ${mk}
    ${glide}
    <path class="proj" d="${path(S.proj)}"/>
    <path class="hist" d="${path(S.hist)}"/>
    <path class="hist bad" clip-path="url(#out-${uid})" d="${path(S.hist)}"/>
    <g class="flag" transform="translate(${f(X(S.N))} ${f(Y(quarterTarget))})"><line y2="-17"/><path d="M0 -17L11 -13L0 -9Z"/></g>
    <line class="cursor" y1="${T}" y2="${T + ph}" x1="0" x2="0"/>
    <line class="tline" x1="${tx}" x2="${tx}" y1="${T}" y2="${T + ph}"/>
    <circle class="tdot" cx="${tx}" cy="${ty}" r="6"/>
    <g class="tlab" transform="translate(${bx} ${T + 4})"><rect x="-34" y="-13" width="68" height="20" rx="8"/><text y="2" text-anchor="middle">${fh(S.last.y)}</text></g>
    <rect class="hover" x="${L}" y="${T}" width="${pw}" height="${ph}"/>
  </svg>`;

  const byDay = {};
  [...S.hist, ...S.proj].forEach(p => { if (p.k > 0) byDay[p.k] = p; });
  return { svg, S, marks, dims: { W, L, pw, T, ph, X }, byDay };
}

function trendHTML(uid) {
  const c = trendChart(uid), { S, marks } = c, { limitMax, limitMin, quarterTarget } = state.settings;
  const rows = marks.map(m => {
    const lbl = m.last
      ? (Math.abs(m.y - quarterTarget) < 0.01 ? `<span class="badge ok">at target</span>` : `<span class="badge ${m.ok ? 'warn' : 'bad'}">${fh(Math.abs(m.y - quarterTarget), false)} ${m.y > quarterTarget ? 'over' : 'short'} of target</span>`)
      : `<span class="badge ${m.ok ? 'ok' : 'bad'}">${m.ok ? 'within limit' : 'outside limit'}</span>`;
    return `<li><span class="d">${m.last ? 'Quarter end' : 'Month end'} · ${dayLabel2(m.me)}</span><span class="tab ${cls(m.y)}"><b>${fh(m.y)}</b></span>${lbl}<span class="muted">${m.past ? 'actual' : 'projected'}</span></li>`;
  }).join('');
  return { c, html: `<section class="panel trend">
    <div class="trendhead"><h2>Balance trajectory</h2><span class="muted">${S.qs.toLocaleDateString('en', { month: 'short' })} – ${S.qe.toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span></div>
    <div class="trendwrap">${c.svg}<div class="ttip" role="tooltip"></div></div>
    <div class="tlegend"><span><i class="lh"></i>Balance</span><span><i class="lp"></i>Projected</span><span><i class="lg"></i>Path to target</span><span><i class="lc"></i>Limit</span></div>
    <ul class="list cps">${rows}</ul>
    <p class="dsub tnote">Projected assumes you work exactly your target from here; only leave or hours already booked move the line. The quarter ends at ${fh(quarterTarget)}.</p>
  </section>` };
}

// Hover: a cursor line and the balance for the day under the pointer.
function attachTrendHover(root, c) {
  const svg = root.querySelector('svg.trendsvg'), tip = root.querySelector('.ttip'), cur = svg.querySelector('.cursor');
  if (!svg) return;
  const { W, L, pw, X } = c.dims;
  svg.addEventListener('mousemove', ev => {
    const r = svg.getBoundingClientRect(), vx = (ev.clientX - r.left) / r.width * W;
    const k = Math.round(Math.max(1, Math.min(c.S.N, (vx - L) / pw * c.S.N)));
    const p = c.byDay[k]; if (!p) return;
    cur.setAttribute('x1', X(k)); cur.setAttribute('x2', X(k)); cur.style.opacity = 1;
    tip.innerHTML = `${dayLabel2(p.d)}: <b>${fh(p.y)}</b>${p.proj ? ' (projected)' : ''}`;
    tip.style.left = Math.min(Math.max(X(k) / W * r.width, 60), r.width - 60) + 'px'; tip.classList.add('on');
  });
  svg.addEventListener('mouseleave', () => { cur.style.opacity = 0; tip.classList.remove('on'); });
}
