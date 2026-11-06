// Runs on BambooHR pages. Adds a small "Send to VibeTime" button when a timesheet is on screen.
// The page is only read when you click the button, and the result goes to the VibeTime tab and nowhere else.
(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  let host = null, label = null, toastEl = null;

  function build() {
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      button { font:700 14px/1.2 system-ui,sans-serif; padding:10px 16px; border:3px solid #0b0727; border-radius:14px; background:#ffc83d; color:#1d1640; box-shadow:3px 3px 0 #0b0727; cursor:pointer; }
      button:hover { transform:translate(-1px,-1px); box-shadow:4px 4px 0 #0b0727; }
      .t { position:absolute; right:0; bottom:54px; width:260px; padding:8px 12px; border:3px solid #0b0727; border-radius:12px; background:#fffaf0; color:#1d1640; font:600 13px/1.35 system-ui,sans-serif; display:none; }
    </style><div class="t" role="status"></div><button type="button">Send to VibeTime</button>`;
    label = shadow.querySelector('button'); toastEl = shadow.querySelector('.t');
    label.addEventListener('click', send);
    document.documentElement.appendChild(host);
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.style.display = 'block';
    clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.style.display = 'none'; }, 6000);
  }
  async function send() {
    const data = VibeParse.parseTimesheet(document, new Date());
    const useful = data.days.filter(d => d.worked || d.entries.length || d.timeOff.length);
    if (!useful.length) { toast('No timesheet days found on this page. Open the Timesheet tab and try again.'); return; }
    try {
      await api.runtime.sendMessage({ type: 'vibetime-send', payload: { source: 'bamboohr', version: 1, period: data.period, days: useful } });
      toast(`Sent ${useful.length} day${useful.length === 1 ? '' : 's'} to VibeTime. A VibeTime tab is opening.`);
    } catch (e) { toast('Could not hand the days to VibeTime: ' + (e && e.message || e)); }
  }
  // the timesheet is drawn after the page loads, so keep an eye out for it
  function refresh() {
    const has = !!document.querySelector('.TimesheetSlat');
    if (has && !host) build();
    if (host) host.style.display = has ? 'block' : 'none';
  }
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
