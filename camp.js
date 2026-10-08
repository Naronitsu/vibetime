// The camp window: a small scene where your hiker admires the view when no timer is running, hikes while it runs,
// eats during a break and sleeps after you stop. Used big on the Today page and small in the sidebar on other pages.
// Needs app.js (weather, stats) and timer.js (campState, readTimer, timerMs, clock).

const CAMP_TEXT = { view: ['Admiring the view', 'Press play to set off'], hike: ['Hiking up the trail', ''], break: ['Snack break', ''], rest: ['Sleeping', 'Good work today'] };
const CAMP_ALT = { view: 'Your hiker standing and admiring the view', hike: 'Your hiker hiking up the trail', break: 'Your hiker eating a snack by the campfire', rest: 'Your hiker asleep by the campfire' };

const CAMP_SVG = `<svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Your hiker standing and admiring the view">
          <defs><linearGradient id="csg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky1)"/><stop offset="1" style="stop-color:var(--sky2)"/></linearGradient></defs>
          <rect width="320" height="120" fill="url(#csg)"/>
          <rect class="cs-heat" width="320" height="120"/>
          <g class="cs-sungrp"><circle class="cs-rays" cx="278" cy="24" r="15"/><circle class="cs-sun" cx="278" cy="24" r="9"/></g>
          <g class="cs-clouds"><g class="cs-cloud c1"><ellipse cx="70" cy="28" rx="26" ry="9"/><ellipse cx="88" cy="22" rx="16" ry="10"/><ellipse cx="54" cy="24" rx="13" ry="8"/></g><g class="cs-cloud c2"><ellipse cx="220" cy="20" rx="30" ry="10"/><ellipse cx="242" cy="13" rx="18" ry="11"/><ellipse cx="200" cy="15" rx="14" ry="8"/></g></g>
          <g class="cs-far m3 stroke"><path d="M-112 96 L-68 56 L-22 96 Z"/><path d="M-12 96 L32 56 L78 96 Z"/><path d="M88 96 L132 56 L178 96 Z"/><path d="M188 96 L232 56 L278 96 Z"/><path d="M288 96 L332 56 L378 96 Z"/><path d="M388 96 L432 56 L478 96 Z"/><path d="M488 96 L532 56 L578 96 Z"/></g>
          <g class="cs-near m1 stroke"><path d="M-166 96 L-102 38 L-26 96 Z"/><path d="M-6 96 L58 38 L134 96 Z"/><path d="M154 96 L218 38 L294 96 Z"/><path d="M314 96 L378 38 L454 96 Z"/><path d="M474 96 L538 38 L614 96 Z"/></g>
          <rect class="cs-ground" x="-4" y="94" width="330" height="30"/>
          <line class="cs-track" x1="-4" y1="106" x2="326" y2="106"/>
          <g class="bird"><path d="M0 0 q4 -5 8 0 q4 -5 8 0"/></g>
          <rect class="cs-dim" width="320" height="120"/>
          <path class="cs-bolt" d="M214 10 L200 48 L212 48 L204 80 L228 40 L216 40 L224 10 Z"/>
          <rect class="cs-flash" width="320" height="120"/>
          <g class="p-fire" transform="translate(206 96)">
            <path class="smoke" d="M0 -26 q-5 -7 0 -13 t0 -13"/>
            <g class="flames"><path class="fl a" d="M-8 -3 Q-11 -14 -2 -24 Q-1 -14 4 -18 Q10 -8 8 -3 Z"/><path class="fl b" d="M-4 -3 Q-5 -9 0 -14 Q5 -9 4 -3 Z"/></g>
            <rect class="log" x="-14" y="-5" width="28" height="6" rx="3" transform="rotate(8)"/><rect class="log" x="-14" y="-5" width="28" height="6" rx="3" transform="rotate(-8)"/>
          </g>
          <g class="p-zzz" transform="translate(112 62)">
            <text class="z z1" x="0" y="0">Z</text><text class="z z2" x="10" y="-10">Z</text><text class="z z3" x="21" y="-21">Z</text>
          </g>
          <g class="cs-rain"><g class="cs-rainin"><line x1="11" y1="-24" x2="8" y2="-15"/><line x1="33" y1="-24" x2="30" y2="-15"/><line x1="55" y1="-24" x2="52" y2="-15"/><line x1="77" y1="-24" x2="74" y2="-15"/><line x1="99" y1="-24" x2="96" y2="-15"/><line x1="121" y1="-24" x2="118" y2="-15"/><line x1="143" y1="-24" x2="140" y2="-15"/><line x1="165" y1="-24" x2="162" y2="-15"/><line x1="187" y1="-24" x2="184" y2="-15"/><line x1="209" y1="-24" x2="206" y2="-15"/><line x1="231" y1="-24" x2="228" y2="-15"/><line x1="253" y1="-24" x2="250" y2="-15"/><line x1="275" y1="-24" x2="272" y2="-15"/><line x1="297" y1="-24" x2="294" y2="-15"/><line x1="319" y1="-24" x2="316" y2="-15"/><line x1="341" y1="-24" x2="338" y2="-15"/><line x1="0" y1="0" x2="-3" y2="9"/><line x1="22" y1="0" x2="19" y2="9"/><line x1="44" y1="0" x2="41" y2="9"/><line x1="66" y1="0" x2="63" y2="9"/><line x1="88" y1="0" x2="85" y2="9"/><line x1="110" y1="0" x2="107" y2="9"/><line x1="132" y1="0" x2="129" y2="9"/><line x1="154" y1="0" x2="151" y2="9"/><line x1="176" y1="0" x2="173" y2="9"/><line x1="198" y1="0" x2="195" y2="9"/><line x1="220" y1="0" x2="217" y2="9"/><line x1="242" y1="0" x2="239" y2="9"/><line x1="264" y1="0" x2="261" y2="9"/><line x1="286" y1="0" x2="283" y2="9"/><line x1="308" y1="0" x2="305" y2="9"/><line x1="330" y1="0" x2="327" y2="9"/><line x1="11" y1="24" x2="8" y2="33"/><line x1="33" y1="24" x2="30" y2="33"/><line x1="55" y1="24" x2="52" y2="33"/><line x1="77" y1="24" x2="74" y2="33"/><line x1="99" y1="24" x2="96" y2="33"/><line x1="121" y1="24" x2="118" y2="33"/><line x1="143" y1="24" x2="140" y2="33"/><line x1="165" y1="24" x2="162" y2="33"/><line x1="187" y1="24" x2="184" y2="33"/><line x1="209" y1="24" x2="206" y2="33"/><line x1="231" y1="24" x2="228" y2="33"/><line x1="253" y1="24" x2="250" y2="33"/><line x1="275" y1="24" x2="272" y2="33"/><line x1="297" y1="24" x2="294" y2="33"/><line x1="319" y1="24" x2="316" y2="33"/><line x1="341" y1="24" x2="338" y2="33"/><line x1="0" y1="48" x2="-3" y2="57"/><line x1="22" y1="48" x2="19" y2="57"/><line x1="44" y1="48" x2="41" y2="57"/><line x1="66" y1="48" x2="63" y2="57"/><line x1="88" y1="48" x2="85" y2="57"/><line x1="110" y1="48" x2="107" y2="57"/><line x1="132" y1="48" x2="129" y2="57"/><line x1="154" y1="48" x2="151" y2="57"/><line x1="176" y1="48" x2="173" y2="57"/><line x1="198" y1="48" x2="195" y2="57"/><line x1="220" y1="48" x2="217" y2="57"/><line x1="242" y1="48" x2="239" y2="57"/><line x1="264" y1="48" x2="261" y2="57"/><line x1="286" y1="48" x2="283" y2="57"/><line x1="308" y1="48" x2="305" y2="57"/><line x1="330" y1="48" x2="327" y2="57"/><line x1="11" y1="72" x2="8" y2="81"/><line x1="33" y1="72" x2="30" y2="81"/><line x1="55" y1="72" x2="52" y2="81"/><line x1="77" y1="72" x2="74" y2="81"/><line x1="99" y1="72" x2="96" y2="81"/><line x1="121" y1="72" x2="118" y2="81"/><line x1="143" y1="72" x2="140" y2="81"/><line x1="165" y1="72" x2="162" y2="81"/><line x1="187" y1="72" x2="184" y2="81"/><line x1="209" y1="72" x2="206" y2="81"/><line x1="231" y1="72" x2="228" y2="81"/><line x1="253" y1="72" x2="250" y2="81"/><line x1="275" y1="72" x2="272" y2="81"/><line x1="297" y1="72" x2="294" y2="81"/><line x1="319" y1="72" x2="316" y2="81"/><line x1="341" y1="72" x2="338" y2="81"/><line x1="0" y1="96" x2="-3" y2="105"/><line x1="22" y1="96" x2="19" y2="105"/><line x1="44" y1="96" x2="41" y2="105"/><line x1="66" y1="96" x2="63" y2="105"/><line x1="88" y1="96" x2="85" y2="105"/><line x1="110" y1="96" x2="107" y2="105"/><line x1="132" y1="96" x2="129" y2="105"/><line x1="154" y1="96" x2="151" y2="105"/><line x1="176" y1="96" x2="173" y2="105"/><line x1="198" y1="96" x2="195" y2="105"/><line x1="220" y1="96" x2="217" y2="105"/><line x1="242" y1="96" x2="239" y2="105"/><line x1="264" y1="96" x2="261" y2="105"/><line x1="286" y1="96" x2="283" y2="105"/><line x1="308" y1="96" x2="305" y2="105"/><line x1="330" y1="96" x2="327" y2="105"/><line x1="11" y1="120" x2="8" y2="129"/><line x1="33" y1="120" x2="30" y2="129"/><line x1="55" y1="120" x2="52" y2="129"/><line x1="77" y1="120" x2="74" y2="129"/><line x1="99" y1="120" x2="96" y2="129"/><line x1="121" y1="120" x2="118" y2="129"/><line x1="143" y1="120" x2="140" y2="129"/><line x1="165" y1="120" x2="162" y2="129"/><line x1="187" y1="120" x2="184" y2="129"/><line x1="209" y1="120" x2="206" y2="129"/><line x1="231" y1="120" x2="228" y2="129"/><line x1="253" y1="120" x2="250" y2="129"/><line x1="275" y1="120" x2="272" y2="129"/><line x1="297" y1="120" x2="294" y2="129"/><line x1="319" y1="120" x2="316" y2="129"/><line x1="341" y1="120" x2="338" y2="129"/></g></g>
          <g class="umb2" transform="translate(132 95)"><line x1="0" y1="0" x2="0" y2="-34"/><path d="M-24 -34 Q-24 -52 0 -52 Q24 -52 24 -34 Q16 -39 12 -34 Q6 -39 0 -34 Q-6 -39 -12 -34 Q-16 -39 -24 -34 Z"/></g>
          <g class="chr">
            <g class="legs">
              <rect class="leg legB" x="-6" y="-9" width="5" height="10" rx="2.5"/>
              <rect class="leg legF" x="1" y="-9" width="5" height="10" rx="2.5"/>
            </g>
            <g class="torso">
              <line class="limb armB" x1="-5" y1="-24" x2="-6" y2="-14"/>
              <g class="umb"><line class="pole2" x1="-4" y1="-34" x2="-4" y2="-68"/><path class="canopy" d="M-26 -66 Q-26 -84 -4 -84 Q18 -84 18 -66 Q11 -71 7 -66 Q1 -71 -4 -66 Q-9 -71 -15 -66 Q-21 -71 -26 -66 Z"/></g>
              <rect class="body" x="-9" y="-30" width="18" height="23" rx="7"/>
              <g class="head">
                <circle class="face" cx="0" cy="-39" r="9"/>
                <circle class="eye open" cx="4" cy="-40" r="1.4"/><path class="eye shut" d="M2 -40 q2 2 4 0"/>
                <path class="sweat" d="M10 -46 q-2.4 3.4 0 4.6 q2.4 -1.2 0 -4.6"/>
                <path class="hat" d="M-11 -43 L1 -62 L11 -43 Z"/>
              </g>
              <g class="armF">
                <line class="limb" x1="3" y1="-25" x2="12" y2="-16"/>
                <g class="pole"><line class="limb thin" x1="12" y1="-16" x2="20" y2="0"/></g>
                <circle class="food" cx="12" cy="-16" r="3.6"/>
              </g>
            </g>
          </g>
        </svg>`;

// Fills `camp` (an element with class "camp") with the scene and starts animating it. Returns { update(light) }.
function mountCamp(camp, { caption = false } = {}) {
  camp.dataset.s = camp.dataset.s || 'view'; camp.dataset.wx = camp.dataset.wx || 'clear';
  camp.insertAdjacentHTML('afterbegin', CAMP_SVG);
  const svg = camp.querySelector('svg');
  let capTitle = null, capSub = null;
  if (caption) {
    camp.insertAdjacentHTML('beforeend', '<div class="campcap"><b></b><span></span></div>');
    capTitle = camp.querySelector('.campcap b'); capSub = camp.querySelector('.campcap span');
  }
  // `light` skips the weather lookup (it is only needed when your balance may have changed)
  function update(light = false) {
    const s = campState(), t = readTimer();
    if (!light) camp.dataset.wx = weather(stats().bal).key;
    if (camp.dataset.s !== s) { camp.dataset.s = s; svg.setAttribute('aria-label', CAMP_ALT[s]); }
    if (capTitle) { capTitle.textContent = CAMP_TEXT[s][0]; capSub.textContent = t ? clock(timerMs(t)) : CAMP_TEXT[s][1]; }
  }
  update();
  startHiker(camp);
  return { update, el: camp };
}

// ---- the hiker's skeleton: every pose is a handful of angles that ease toward the current state's pose,
// so changing state is a smooth blend. Walking speed is tied to how fast the scenery slides, so the feet don't skate.
function startHiker(camp) {
  const q = c => camp.querySelector(c);
  const el = { chr: q('.chr'), lb: q('.legB'), lf: q('.legF'), af: q('.armF'), ab: q('.armB'), torso: q('.torso'), head: q('.head'),
    eye: q('.eye.open'), far: q('.cs-far'), near: q('.cs-near'), track: q('.cs-track') };
  const POSE = {
    view:  { x: 110, y: 96,  r: 0,   lb: 5,   lf: -5,  af: -128, ab: 0, lean: 0 },
    hike:  { x: 110, y: 96,  r: 0,   lb: 0,   lf: 0,   af: -9,   ab: 0, lean: 7 },
    break: { x: 150, y: 105, r: 0,   lb: -90, lf: -90, af: 0,    ab: 0, lean: 0 },
    rest:  { x: 150, y: 87,  r: -90, lb: 0,   lf: 0,   af: 30,   ab: 0, lean: 0 },
  };
  const cur = { ...POSE.view, sx: 1, move: 0, phase: 0, scroll: 0, vx: 0, w: { view: 1, hike: 0, break: 0, rest: 0 } };
  const lerp = (a, b, k) => a + (b - a) * k, ease = (dt, k) => 1 - Math.exp(-k * dt), sm = x => x * x * (3 - 2 * x);
  const STRIDE = 0.9, SPEED = 21;                       // seconds per full step cycle; scenery units per second
  let t = 0, blinkAt = 2.5, last = 0, raf = 0;

  function step(dt) {
    t += dt;
    const st = camp.dataset.s, wx = camp.dataset.wx, rainy = wx === 'showers' || wx === 'storm';
    const P = { ...POSE[st] }; if (rainy && st !== 'rest') P.ab = 180;     // back hand holds the umbrella up
    if ((st === 'break' || st === 'rest') && Math.abs(cur.x - P.x) > 8) Object.assign(P, { y: 96, r: 0, lb: 0, lf: 0, af: 0 });   // walk over first, then sit or lie down
    const k = ease(dt, 7);
    for (const key of ['y', 'r', 'lb', 'lf', 'af', 'ab', 'lean']) cur[key] = lerp(cur[key], P[key], k);
    const px = cur.x; cur.x = lerp(cur.x, P.x, ease(dt, 3)); cur.vx = dt ? (cur.x - px) / dt : 0;
    for (const m in cur.w) cur.w[m] = lerp(cur.w[m], m === st ? 1 : 0, ease(dt, 6));
    // walking: always while hiking, and also while strolling over to a new spot
    cur.move = lerp(cur.move, Math.max(st === 'hike' ? 1 : 0, Math.min(1, Math.abs(cur.vx) / 24)), ease(dt, 8));
    cur.phase += dt * (Math.PI * 2 / STRIDE) * cur.move;
    cur.sx = lerp(cur.sx, Math.abs(cur.vx) > 4 ? Math.sign(cur.vx) : 1, ease(dt, 10));   // turn round when heading left
    const sw = Math.sin(cur.phase) * cur.move;
    // scenery slides at the speed the planted foot moves back
    cur.scroll += SPEED * cur.w.hike * dt;
    el.track.style.strokeDashoffset = -(cur.scroll % 22);
    el.far.setAttribute('transform', `translate(${-(cur.scroll * 0.18 % 100)} 0)`);
    el.near.setAttribute('transform', `translate(${-(cur.scroll * 0.34 % 160)} 0)`);
    // overlays on top of the blended base pose
    const u = (t / 1.8) % 1;
    const bite = u < .15 ? 0 : u < .4 ? sm((u - .15) / .25) : u < .62 ? 1 : u < .9 ? 1 - sm((u - .62) / .28) : 0;
    const holding = Math.pow(bite, 8);
    const af = cur.af + 24 * sw + cur.w.view * 5 * Math.sin(t * 1.3) - cur.w.break * 122 * bite;
    const swingB = 1 - Math.min(1, Math.abs(cur.ab) / 180);                   // no swinging while holding the umbrella
    const ab = cur.ab - 24 * sw * swingB;
    const head = cur.w.view * (-2 + 6 * Math.sin(t * 0.65)) + cur.w.break * holding * 3 * Math.sin(t * 16) + 2.5 * sw;
    const bob = Math.abs(Math.sin(cur.phase)) * 1.6 * cur.move;
    const breath = 1 + 0.022 * Math.sin(t * 2 * (1 + cur.w.rest * -.4));
    let eye = 1;
    if (t >= blinkAt) { const b = (t - blinkAt) / .14; if (b < 1) eye = 1 - .9 * Math.sin(b * Math.PI); else blinkAt = t + 2.5 + Math.random() * 3.5; }
    const f = n => n.toFixed(2);
    el.chr.setAttribute('transform', `translate(${f(cur.x)} ${f(cur.y)}) rotate(${f(cur.r)}) scale(${f(cur.sx)} 1)`);
    el.lb.setAttribute('transform', `rotate(${f(cur.lb + 28 * sw)} -3.5 -9)`);
    el.lf.setAttribute('transform', `rotate(${f(cur.lf - 28 * sw)} 3.5 -9)`);
    el.torso.setAttribute('transform', `translate(0 ${f(-bob)}) rotate(${f(cur.lean)} 0 -9) translate(0 -9) scale(1 ${f(breath)}) translate(0 9)`);
    el.head.setAttribute('transform', `rotate(${f(head)} 0 -30)`);
    el.af.setAttribute('transform', `rotate(${f(af)} 3 -25)`);
    el.ab.setAttribute('transform', `rotate(${f(ab)} -5 -24)`);
    el.eye.setAttribute('transform', `translate(4 -40) scale(1 ${f(eye)}) translate(-4 40)`);
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    step(dt); raf = requestAnimationFrame(frame);
  }
  if (still) {                                         // no motion: jump straight to each pose
    const settle = () => { for (let i = 0; i < 40; i++) step(.1); };
    settle(); new MutationObserver(settle).observe(camp, { attributes: true });
  } else {                                             // only animate while the camp is on screen and the tab is visible
    let visible = true;
    const run = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const halt = () => { cancelAnimationFrame(raf); raf = 0; };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? run() : halt(); }).observe(camp);
    document.addEventListener('visibilitychange', () => document.hidden ? halt() : run());
    for (let i = 0; i < 40; i++) step(.1);             // start from the right pose, not from a jump
    run();
  }
}
