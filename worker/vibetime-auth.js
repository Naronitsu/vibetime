// VibeTime sign-in helper: a tiny Cloudflare Worker that keeps your Google "client secret" so the website can
// stay signed in to Google Drive. It only swaps sign-in codes for tokens and refreshes tokens; your hours and
// your Drive file never pass through it (the browser talks to Google Drive directly).
//
// It also serves the signed Firefox extension at /vibetime.xpi with the content type Firefox wants, so a click on the
// Install button in VibeTime's Settings makes Firefox offer to add it (GitHub would only download the file).
// extension/releases/latest.txt in the repo names the newest file, so a new release never needs a change here.
//
// Setup (free): Cloudflare dashboard > Workers & Pages > Create > Hello World > Deploy, then Edit code and paste
// this file. Under Settings > Variables and Secrets add:
//   GOOGLE_CLIENT_ID      (text)    your Google OAuth client ID
//   GOOGLE_CLIENT_SECRET  (secret)  the client secret from Google Cloud > Credentials (never put it in the repo)
//   ALLOWED_ORIGINS       (text)    https://naronitsu.github.io,http://localhost:8765
// Then deploy and copy the Worker's URL into AUTH_WORKER in sync.js.

const GOOGLE = 'https://oauth2.googleapis.com';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }
      : null;

    // the signed extension (a plain GET, so it is not limited to the allowed origins; it is public anyway)
    if ((request.method === 'GET' || request.method === 'HEAD') && new URL(request.url).pathname === '/vibetime.xpi') return serveExtension(request.method);

    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (!cors || request.method !== 'POST') return reply({ error: 'forbidden' }, 403, cors || {});

    let body;
    try { body = await request.json(); } catch { return reply({ error: 'bad_request' }, 400, cors); }
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    const form = o => new URLSearchParams(o);

    // swap the sign-in code from Google for tokens (this is the step that needs the client secret)
    if (path === '/token') {
      const { code, code_verifier, redirect_uri } = body;
      const okRedirect = typeof redirect_uri === 'string' && allowed.some(o => redirect_uri.startsWith(o + '/'));
      if (!code || !code_verifier || !okRedirect) return reply({ error: 'bad_request' }, 400, cors);
      return forward(await fetch(`${GOOGLE}/token`, { method: 'POST', body: form({
        client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: 'authorization_code', code, code_verifier, redirect_uri }) }), cors);
    }

    // trade the long-lasting refresh token for a fresh one-hour access token
    if (path === '/refresh') {
      if (!body.refresh_token) return reply({ error: 'bad_request' }, 400, cors);
      return forward(await fetch(`${GOOGLE}/token`, { method: 'POST', body: form({
        client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token', refresh_token: body.refresh_token }) }), cors);
    }

    // sign out: ask Google to cancel the token
    if (path === '/revoke') {
      if (body.token) await fetch(`${GOOGLE}/revoke`, { method: 'POST', body: form({ token: body.token }) });
      return reply({ ok: true }, 200, cors);
    }

    return reply({ error: 'not_found' }, 404, cors);
  },
};

const reply = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// pass on only what the website needs
async function forward(res, cors) {
  const j = await res.json().catch(() => ({}));
  return res.ok
    ? reply({ access_token: j.access_token, expires_in: j.expires_in, refresh_token: j.refresh_token }, 200, cors)
    : reply({ error: j.error || 'google_error', error_description: j.error_description }, 400, cors);
}

// Fetches extension/releases/<latest.txt> from the repo and hands it to Firefox as an installable add-on.
const RAW = 'https://raw.githubusercontent.com/Naronitsu/vibetime/main/extension/releases/';
async function serveExtension(method) {
  const open = { 'Access-Control-Allow-Origin': '*' };                 // lets VibeTime check that this is available
  try {
    const name = (await (await fetch(RAW + 'latest.txt', { cf: { cacheTtl: 120 } })).text()).trim();
    if (!/^[A-Za-z0-9._-]+\.xpi$/.test(name)) return reply({ error: 'bad_release' }, 502, open);
    const file = await fetch(RAW + name, { cf: { cacheTtl: 120 } });
    if (!file.ok) return reply({ error: 'not_found' }, 502, open);
    return new Response(method === 'HEAD' ? null : file.body, { status: 200, headers: { ...open, 'Content-Type': 'application/x-xpinstall', 'Cache-Control': 'public, max-age=120' } });
  } catch { return reply({ error: 'unavailable' }, 502, open); }
}
