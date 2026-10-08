// Guided tour of the Today page: a spotlight on one thing at a time with a short explanation.
// Starts by itself once, right after first-time setup (welcome.html sets the flag), and any time from "Show me around".
const TOUR_KEY = 'vibetime.tour';
const TOUR_STEPS = [
  { sel: '.hero', title: 'Your quest', text: 'The mountain shows how far through the quarter you are. The weather shows how your balance sits against the monthly limit. The goal is to reach the flag, the last day of the quarter, back at zero.' },
  { sel: '#stats .stat:nth-child(1)', title: 'Balance', text: 'Your plus or minus against your target, and how much of it came from this month. Past working days with nothing logged count as 0h until you fill them in.' },
  { sel: '#stats .stat:nth-child(2)', title: 'Monthly limit', text: 'The dot should stay between the two ends. Go past either one and the weather turns.' },
  { sel: '.weekcard', title: 'This week’s stars', text: 'Every working day is a star. Log the day and it lights up. Open the Stars page to see the whole year.' },
  { sel: '#leaves', title: 'PTO and sick leave', text: 'The bottles show what is left of your yearly allowance. Click one to book dates, even a whole period at once, or to review what you booked.' },
  { sel: '#timer', title: 'The timer', text: 'Press play when you start working. Pause for a break, play to carry on, and stop to add the time to today.' },
  { sel: '#hours', title: 'Log the day', text: 'Type hours like 7h 45m or 7.75, or time slots like 8:00-12:00, 13:00-15:00 and VibeTime adds them up. PTO and sick leave can share the same day. Fill rest tops it up to a full day.' },
  { sel: () => document.getElementById('missing').closest('.panel'), title: 'Unlogged days', text: 'Past working days you haven’t logged show up here. Log a full day, or mark PTO or sick, with one click.' },
  { sel: '.side nav', right: true, title: 'Find your way around', text: 'The Calendar lets you edit any day. Stars is your year chart. In Settings you pick your country for public holidays, set your allowances and limits, and export a backup.' },
];

function startTour(from = 0) {
  if (document.getElementById('tour')) return;
  try { localStorage.setItem(TOUR_KEY, 'done'); } catch {}
  const steps = TOUR_STEPS.map(s => ({ ...s, el: typeof s.sel === 'function' ? s.sel() : document.querySelector(s.sel) }))
    .filter(s => s.el && s.el.getClientRects().length);
  if (!steps.length) return;
  let i = Math.min(from, steps.length - 1);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div');
  root.id = 'tour';
  root.innerHTML = `<div class="tshield"></div><div class="tspot"></div>
    <div class="tcard" role="dialog" aria-modal="true" aria-labelledby="tt" aria-describedby="tx">
      <div class="tdots" aria-hidden="true"></div>
      <h3 id="tt"></h3><p id="tx"></p>
      <div class="tact"><button class="btn sm" type="button" data-t="skip">Skip tour</button><span class="sp"></span><button class="btn sm" type="button" data-t="back">Back</button><button class="btn sm primary" type="button" data-t="next"></button></div>
    </div>`;
  document.body.appendChild(root);
  const spot = root.querySelector('.tspot'), card = root.querySelector('.tcard');
  const previous = document.activeElement;

  function place() {
    const el = steps[i].el, r = el.getBoundingClientRect(), pad = 8, gap = 14;
    const vw = innerWidth, vh = innerHeight;
    Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const cw = Math.min(360, vw - 24);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight, cx = v => Math.max(12, Math.min(v, vw - cw - 12));
    let x, y;
    if (steps[i].right && r.right + pad + gap + cw <= vw - 8) { x = r.right + pad + gap; y = Math.max(8, Math.min(r.top, vh - ch - 8)); }
    else if (r.bottom + pad + gap + ch <= vh - 8) { x = cx(r.left); y = r.bottom + pad + gap; }
    else if (r.top - pad - gap - ch >= 8) { x = cx(r.left); y = r.top - pad - gap - ch; }
    else if (r.right + pad + gap + cw <= vw - 8) { x = r.right + pad + gap; y = Math.max(8, Math.min(r.top, vh - ch - 8)); }
    else if (r.left - pad - gap - cw >= 8) { x = r.left - pad - gap - cw; y = Math.max(8, Math.min(r.top, vh - ch - 8)); }
    else { x = cx((vw - cw) / 2); y = vh - ch - 12; }       // nowhere beside it: sit at the bottom of the screen
    card.style.left = x + 'px'; card.style.top = y + 'px';
  }
  function show(n, dir = 0) {
    i = n;
    const s = steps[i];
    card.querySelector('#tt').textContent = s.title;
    card.querySelector('#tx').textContent = s.text;
    card.querySelector('.tdots').innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('');
    card.querySelector('[data-t="back"]').hidden = i === 0;
    card.querySelector('[data-t="next"]').textContent = i === steps.length - 1 ? 'Done' : 'Next';
    s.el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    place();
    setTimeout(place, 350); setTimeout(place, 700);     // again once the smooth scroll has settled
    card.querySelector('[data-t="next"]').focus({ preventScroll: true });
    if (dir && !reduced) card.animate([{ opacity: 0, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  function close() {
    root.remove();
    removeEventListener('resize', place); removeEventListener('scroll', place, true); removeEventListener('keydown', onKey, true);
    if (previous && previous.focus) previous.focus({ preventScroll: true });
  }
  const go = d => { const n = i + d; if (n >= steps.length) close(); else if (n >= 0) show(n, d); };
  function onKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); go(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
    else if (ev.key === 'Tab') {                          // keep focus inside the tour
      const btns = [...card.querySelectorAll('button:not([hidden])')], at = btns.indexOf(document.activeElement);
      ev.preventDefault();
      btns[(at + (ev.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
    }
  }
  card.addEventListener('click', ev => {
    const b = ev.target.closest('[data-t]'); if (!b) return;
    if (b.dataset.t === 'skip') close(); else go(b.dataset.t === 'next' ? 1 : -1);
  });
  addEventListener('resize', place); addEventListener('scroll', place, true); addEventListener('keydown', onKey, true);
  show(i);
}

// Automatic start: only once, and only right after first-time setup.
(() => {
  let pending = false;
  try { pending = localStorage.getItem(TOUR_KEY) === 'pending'; } catch {}
  if (pending) setTimeout(() => startTour(), 1100);
})();
