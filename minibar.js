// A small tracker in the sidebar on every page except Today (which has the full one): your hiker, the clock
// and pause / stop, shown while a timer is running or paused. Needs app.js, timer.js and camp.js.
document.addEventListener('DOMContentLoaded', () => {
  const side = document.querySelector('.side');
  if (!side || document.getElementById('timer')) return;
  const box = document.createElement('div');
  box.className = 'minibar'; box.id = 'minibar'; box.hidden = true;
  box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Work timer');
  box.innerHTML = '<div class="camp mini" data-s="hike"></div><div class="mbrow"><div class="mbtxt"><b class="mblabel"></b><span class="mbclock tab"></span></div><div class="mbbtns"></div></div>';
  side.insertBefore(box, document.getElementById('theme'));
  const camp = mountCamp(box.querySelector('.camp'));
  const label = box.querySelector('.mblabel'), clk = box.querySelector('.mbclock'), btns = box.querySelector('.mbbtns');
  const baseTitle = document.title;
  let message = '';                                     // shown briefly after stopping

  const btn = (a, ic, text, extra = '') => `<button type="button" class="tbtn sm ${extra}" data-t="${a}" title="${text}" aria-label="${text}">${TI[ic]}</button>`;
  function render(light = false) {
    const t = readTimer();
    box.hidden = !t && !message;
    side.classList.toggle('has-mini', !box.hidden);
    camp.update(light);
    if (message) { label.textContent = message; clk.textContent = ''; btns.innerHTML = ''; return; }
    if (!t) { document.title = baseTitle; return; }
    label.textContent = CAMP_TEXT[campState()][0];
    clk.textContent = clock(timerMs(t));
    document.title = `${t.mode === 'run' ? '▶' : '⏸'} ${clk.textContent} · ${baseTitle}`;
    const html = (t.mode === 'run' ? btn('pause', 'pause', 'Pause for a break') : btn('resume', 'play', 'Continue', 'play')) + btn('stop', 'stop', 'Stop and log the time', 'stop');
    if (btns.dataset.mode !== t.mode) { btns.innerHTML = html; btns.dataset.mode = t.mode; }
  }
  btns.addEventListener('click', ev => {
    const b = ev.target.closest('[data-t]'); if (!b) return;
    btns.dataset.mode = '';
    const r = timerAct(b.dataset.t);
    if (r.cancelled) return;
    if (b.dataset.t === 'stop') {
      message = r.logged ? `Logged ${fh(r.logged, false)}` : r.note;
      document.title = baseTitle; render();
      // the page behind may show hours, so reload it after the hiker has had a moment to lie down
      setTimeout(() => { message = ''; if (r.logged) location.reload(); else render(); }, r.logged ? 2200 : 1800);
      return;
    }
    render();
  });
  setInterval(() => render(true), 1000);
  window.addEventListener('storage', ev => { if (ev.key === TIMER_KEY || ev.key === PUNCH_KEY) { btns.dataset.mode = ''; render(); } });
  render();
});
