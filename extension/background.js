// Hands the timesheet from the BambooHR tab to a VibeTime tab. The days are kept for a few minutes at most,
// only on this computer, and are deleted as soon as VibeTime has picked them up.
const api = typeof browser !== 'undefined' ? browser : chrome;
const VIBETIME = 'https://naronitsu.github.io/vibetime/index.html#bamboo';
const MAX_AGE = 10 * 60 * 1000;

api.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'vibetime-send') {
    // only the BambooHR pages are allowed to send
    if (!sender.url || !/^https:\/\/[a-z0-9-]+\.bamboohr\.(com|co\.uk)\//i.test(sender.url)) return;
    return api.storage.local.set({ pending: { at: Date.now(), payload: msg.payload } })
      .then(() => api.tabs.create({ url: VIBETIME }))
      .then(() => ({ ok: true }));
  }
  if (msg.type === 'vibetime-get') {
    // only the VibeTime pages may collect
    if (!sender.url || !sender.url.startsWith('https://naronitsu.github.io/vibetime/')) return;
    return api.storage.local.get('pending').then(({ pending }) => {
      api.storage.local.remove('pending');
      return pending && Date.now() - pending.at < MAX_AGE ? pending.payload : null;
    });
  }
});
