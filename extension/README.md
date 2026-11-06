# VibeTime for BambooHR (Firefox)

Reads the timesheet you are looking at on BambooHR and sends it to VibeTime, where you see a preview and choose what to import.

## What it does and does not do
- Runs only on `*.bamboohr.com` / `*.bamboohr.co.uk` pages and on `naronitsu.github.io/vibetime`.
- A small **Send to VibeTime** button appears on the Timesheet tab. The page is only read when you click it.
- It reads the days, clock-in/out times, day totals and time-off rows. It never touches your password, cookies or API keys, and makes no network requests of its own.
- The days are handed to a new VibeTime tab through the browser itself (kept for at most 10 minutes, then deleted). Nothing is saved in VibeTime until you press **Import**, and Settings → Undo brings back what you had.

## Install (temporary, until Firefox closes)
1. In Firefox open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** and choose `extension/manifest.json`.
3. Open your BambooHR timesheet and click **Send to VibeTime** (bottom-right).

## Keep it installed
Firefox only keeps signed add-ons after a restart. Either:
- **Sign it for yourself (free):** zip the files in this folder (not the folder itself), sign in at https://addons.mozilla.org/developers/, choose **Submit a new add-on → On your own**, upload the zip. Download the signed `.xpi` and open it in Firefox (`about:addons` → gear → *Install Add-on From File*).
- or use **Firefox Developer Edition / Nightly** and set `xpinstall.signatures.required` to `false` in `about:config`.

If BambooHR changes its timesheet page the reader may stop finding days; the button then says so instead of guessing, and `parse.js` is the only file that needs updating.
