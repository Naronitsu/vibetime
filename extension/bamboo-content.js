// Runs on BambooHR pages.
//   1. A small "Send to VibeTime" button (Timesheet tab and Home page): reads what is on screen when you click it.
//   2. Watches your clock: when you clock in or out, VibeTime is told (your punch-in time, or the finished day).
// It only reads the page. It never clicks anything or changes anything in BambooHR.
(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  let host = null, label = null, toastEl = null;

  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      button { font:700 14px/1.2 system-ui,sans-serif; padding:10px 16px; border:3px solid #0b0727; border-radius:14px; background:#ffc83d; color:#1d1640; box-shadow:3px 3px 0 #0b0727; cursor:pointer; }
      button:hover { transform:translate(-1px,-1px); box-shadow:4px 4px 0 #0b0727; }
      button[hidden] { display:none; }
      .t { position:absolute; right:0; bottom:54px; width:260px; padding:8px 12px; border:3px solid #0b0727; border-radius:12px; background:#fffaf0; color:#1d1640; font:600 13px/1.35 system-ui,sans-serif; display:none; }
    </style><div class="t" role="status"></div><button type="button" hidden>Send to VibeTime</button>`;
    label = shadow.querySelector('button'); toastEl = shadow.querySelector('.t');
    label.addEventListener('click', send);
    document.documentElement.appendChild(host);
  }
  function toast(msg) {
    ensureHost();
    toastEl.textContent = msg; toastEl.style.display = 'block';
    clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.style.display = 'none'; }, 7000);
  }

  // ---- the button
  async function send() {
    const data = VibeParse.parseTimesheet(document, new Date());
    const days = data.days.filter(d => d.worked || d.entries.length || d.timeOff.length);
    const balances = VibeParse.parseBalances(document);
    if (!days.length && !balances.length) { toast('Nothing to send on this page. Open the Timesheet tab (days) or the Home page (time-off balances) and try again.'); return; }
    try {
      await api.runtime.sendMessage({ type: 'vibetime-send', payload: { source: 'bamboohr', version: 1, period: data.period, days, balances } });
      const parts = [];
      if (days.length) parts.push(`${days.length} day${days.length === 1 ? '' : 's'}`);
      if (balances.length) parts.push(`${balances.length} time-off balance${balances.length === 1 ? '' : 's'}`);
      toast(`Sent ${parts.join(' and ')} to VibeTime. A VibeTime tab is opening.`);
    } catch (e) { toast('Could not hand the data to VibeTime: ' + (e && e.message || e)); }
  }

  // ---- the clock
  const hours = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
  async function onClock(ev) {
    const sig = `${ev.kind}|${ev.date}|${JSON.stringify(ev.entries)}`;
    if (ev.initial) {                                              // just opened the page while clocked in: only tell VibeTime if it is news
      const { lastSig } = await api.storage.local.get('lastSig');
      if (lastSig === sig) return;
    }
    await api.storage.local.set({ lastSig: sig });
    try {
      await api.runtime.sendMessage({ type: 'vibetime-auto', payload: { source: 'bamboohr', version: 1, kind: ev.kind, date: ev.date, entries: ev.entries, worked: ev.worked } });
      if (ev.kind === 'out') toast(`Punched out${ev.worked != null ? ` (${hours(ev.worked)} today)` : ''}. Sent to VibeTime.`);
      else if (!ev.initial) toast('Punched in. Sent to VibeTime.');
    } catch (e) { toast('Could not hand your punch to VibeTime: ' + (e && e.message || e)); }
  }
  const monitor = VibeClock.createMonitor({ emit: ev => { onClock(ev).catch(() => {}); } });

  // ---- keep an eye on the page (it is drawn after loading, and the clock changes without a reload)
  let balancesSeen = false, timer = 0;
  function refresh() {
    timer = 0;
    if (!balancesSeen && !document.querySelector('.TimesheetSlat')) balancesSeen = VibeParse.parseBalances(document).length > 0;
    const has = !!document.querySelector('.TimesheetSlat') || balancesSeen;
    if (has) { ensureHost(); label.hidden = false; } else if (label) label.hidden = true;
    monitor.tick();
  }
  new MutationObserver(() => { if (!timer) timer = setTimeout(refresh, 400); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  refresh();
})();
