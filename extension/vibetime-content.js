// Runs on VibeTime pages. If the page was opened by the extension (address ends in #bamboo), it collects the
// timesheet the BambooHR tab sent and gives it to the VibeTime page, which shows a preview before saving anything.
(function () {
  if (location.hash !== '#bamboo') return;
  const api = typeof browser !== 'undefined' ? browser : chrome;
  api.runtime.sendMessage({ type: 'vibetime-get' }).then(payload => {
    if (payload) window.postMessage({ vibetimeBamboo: payload }, location.origin);
  }).catch(() => {});
})();
