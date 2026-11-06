// Hands data from a BambooHR tab to VibeTime. Two kinds:
//   vibetime-send  you pressed "Send to VibeTime": opens a VibeTime tab with a preview you confirm
//   vibetime-auto  your clock changed (punch-in / punch-out): goes to a VibeTime tab that is already open,
//                  or to a new background tab that closes itself once VibeTime has taken it
// Data is kept for a few minutes at most, only on this computer, and is deleted as soon as it has been collected.
const api = typeof browser !== 'undefined' ? browser : chrome;
const BASE = 'https://naronitsu.github.io/vibetime/';
const MAX_AGE = 10 * 60 * 1000;
const fromBamboo = s => !!(s && s.url && /^https:\/\/[a-z0-9-]+\.bamboohr\.(com|co\.uk)\//i.test(s.url));
const fromVibeTime = s => !!(s && s.url && s.url.startsWith(BASE));

async function deliverAuto(payload) {
  // 1) a VibeTime Today page that is already open can take it straight away
  let tabs = [];
  try { tabs = await api.tabs.query({ url: BASE + '*' }); } catch {}
  for (const t of tabs.filter(t => /\/vibetime\/(index\.html)?([?#]|$)/.test(t.url || ''))) {
    try { const r = await api.tabs.sendMessage(t.id, { type: 'vibetime-auto', payload }); if (r && r.handled) return; } catch {}
  }
  // 2) otherwise open VibeTime in the background; it collects the data, applies it and the tab is closed again
  await api.storage.local.set({ pendingAuto: { at: Date.now(), payload } });
  const tab = await api.tabs.create({ url: BASE + 'index.html#bamboo-auto', active: false });
  await api.storage.local.set({ autoTab: tab.id });
}

api.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'vibetime-send' && fromBamboo(sender)) {
    return api.storage.local.set({ pending: { at: Date.now(), payload: msg.payload } })
      .then(() => api.tabs.create({ url: BASE + 'index.html#bamboo' }))
      .then(() => ({ ok: true }));
  }
  if (msg.type === 'vibetime-auto' && fromBamboo(sender)) {
    return deliverAuto(msg.payload).then(() => ({ ok: true }));
  }
  if (msg.type === 'vibetime-get' && fromVibeTime(sender)) {
    return api.storage.local.get('pending').then(({ pending }) => {
      api.storage.local.remove('pending');
      return pending && Date.now() - pending.at < MAX_AGE ? pending.payload : null;
    });
  }
  if (msg.type === 'vibetime-get-auto' && fromVibeTime(sender)) {
    return api.storage.local.get('pendingAuto').then(({ pendingAuto }) => {
      api.storage.local.remove('pendingAuto');
      return pendingAuto && Date.now() - pendingAuto.at < MAX_AGE ? pendingAuto.payload : null;
    });
  }
  if (msg.type === 'vibetime-auto-done' && fromVibeTime(sender) && sender.tab) {
    return api.storage.local.get('autoTab').then(({ autoTab }) => {
      if (autoTab === sender.tab.id) { api.storage.local.remove('autoTab'); api.tabs.remove(sender.tab.id); }   // only a tab we opened ourselves
    });
  }
});
