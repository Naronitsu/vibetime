// Runs on VibeTime pages and passes data from the extension to the VibeTime page.
//   #bamboo       opened by the "Send to VibeTime" button: collect the days and show the preview
//   #bamboo-auto  opened in the background after a clock change: collect it, let the page apply it, then close this tab
//   (any time)    a clock change for a VibeTime Today page that is already open arrives as a message
(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  // let the page know the extension is installed (Settings shows "Installed" instead of an install button)
  const version = api.runtime.getManifest().version;
  document.documentElement.dataset.vibetimeBamboohr = version;
  window.postMessage({ vibetimeExt: version }, location.origin);
  const send = payload => window.postMessage({ vibetimeBamboo: payload }, location.origin);
  const sendAuto = payload => window.postMessage({ vibetimeBambooAuto: payload }, location.origin);

  if (location.hash === '#bamboo') {
    api.runtime.sendMessage({ type: 'vibetime-get' }).then(p => { if (p) send(p); }).catch(() => {});
  }
  if (location.hash === '#bamboo-auto') {
    api.runtime.sendMessage({ type: 'vibetime-get-auto' }).then(p => { if (p) sendAuto(p); else api.runtime.sendMessage({ type: 'vibetime-auto-done' }); }).catch(() => {});
    // the page says when it has finished applying it, then this background tab is closed
    window.addEventListener('message', ev => {
      if (ev.source === window && ev.origin === location.origin && ev.data && ev.data.vibetimeBambooDone) api.runtime.sendMessage({ type: 'vibetime-auto-done' }).catch(() => {});
    });
  }
  api.runtime.onMessage.addListener(msg => {
    if (msg && msg.type === 'vibetime-auto' && document.getElementById('bdlg')) { sendAuto(msg.payload); return Promise.resolve({ handled: true }); }
  });
})();
