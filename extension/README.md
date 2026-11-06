# VibeTime for BambooHR (Firefox)

Reads the timesheet you are looking at on BambooHR and sends it to VibeTime, where you see a preview and choose what to import.

## What it does and does not do
- Runs only on `*.bamboohr.com` / `*.bamboohr.co.uk` pages and on `naronitsu.github.io/vibetime`.
- A small **Send to VibeTime** button appears on the Timesheet tab and on the Home page. The page is only read when you click it.
- On the **Timesheet** tab it reads the days (clock-in/out times, day totals, booked time off). On the **Home** page it reads your time-off balances (available, scheduled, used this year) so VibeTime's PTO and sick allowances can match BambooHR.
- **Your clock:** while a BambooHR page is open, it notices when you clock in or out (the "My Time" widget on Home, or today's row on the Timesheet tab) and tells VibeTime. Punch-in: your punch-in time and breaks go into the leave planner and the VibeTime timer starts from your punch time. Punch-out: today's hours are set to BambooHR's total and the timer stops. VibeTime shows a toast with **Undo**, and Settings -> *Follow my BambooHR clock* turns it off. If no VibeTime tab is open, one opens in the background and closes itself again.
- It cannot see punches made elsewhere (phone app, another computer) until you open a BambooHR page, and then only the Send button picks them up.
- It reads the days, clock-in/out times, day totals and time-off rows. It never touches your password, cookies or API keys, and makes no network requests of its own.
- The days are handed to a new VibeTime tab through the browser itself (kept for at most 10 minutes, then deleted). Nothing is saved in VibeTime until you press **Import**, and Settings → Undo brings back what you had.

## Install the signed version (stays installed)
`extension/releases/vibetime-bamboohr-1.1.1.xpi` is signed by Mozilla (unlisted, self-distributed).
1. Download it from GitHub: open the file in the repo and press **Download raw file** (or use https://github.com/Naronitsu/vibetime/raw/main/extension/releases/vibetime-bamboohr-1.1.1.xpi).
2. In Firefox open `about:addons`, click the gear icon, choose **Install Add-on From File…** and pick the downloaded `.xpi`.

A new version of the extension code needs a new signed file (bump `version` in `manifest.json`, zip the extension files, upload the zip at https://addons.mozilla.org/developers/ as an unlisted version, download the signed `.xpi` into `extension/releases/`). Changes to the VibeTime website itself never need re-signing.

## Install (temporary, until Firefox closes)
1. In Firefox open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** and choose `extension/manifest.json`.
3. Open your BambooHR timesheet and click **Send to VibeTime** (bottom-right).

## Keep it installed
Firefox only keeps signed add-ons after a restart. Either:
- **Sign it for yourself (free):** zip the files in this folder (not the folder itself), sign in at https://addons.mozilla.org/developers/, choose **Submit a new add-on → On your own**, upload the zip. Download the signed `.xpi` and open it in Firefox (`about:addons` → gear → *Install Add-on From File*).
- or use **Firefox Developer Edition / Nightly** and set `xpinstall.signatures.required` to `false` in `about:config`.

If BambooHR changes its timesheet page the reader may stop finding days; the button then says so instead of guessing, and `parse.js` is the only file that needs updating.
