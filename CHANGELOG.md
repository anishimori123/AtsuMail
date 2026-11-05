# Changelog

## Summary

| Version | Date | Time | What changed |
|---|---|---|---|
| v0.9.0 | 2026-11-04 | 6 min | Sheets show the sheet's own colors, bold, alignment, merged cells, column widths |
| v0.8.3 | 2026-11-04 | 4 min | Pixel landscape: camera-side gap reduced to a thin margin |
| v0.8.2 | 2026-11-04 | 8 min | Phone sideways: no blank strip by the camera; only text keeps clear of it |
| v0.8.1 | 2026-11-04 | 5 min | Clearer error messages from Google; detects missing Sheets permission |
| v0.8.0 | 2026-11-04 | 5 min | Connected to Google: real Gmail + Myojin sheet (sign in required) |
| v0.7.3 | 2026-11-04 | 10 min | Privacy policy page (needed for Google sign-in setup) |
| v0.7.2 | 2026-11-01 | 11 min | Light-blue highlight on the sentence being read; tap a sentence to read from there |
| v0.7.0 | 2026-11-01 | 7 min | Built-in voice reader (EN + JA, Soft / Radio DJ / News); F key only for full screen |
| v0.6.4 | 2026-11-01 | 2 min | PC: plain F key also toggles full screen |
| v0.6.3 | 2026-11-01 | 2 min | PC: Ctrl+F turns full screen on/off while an email is open |
| v0.6.2 | 2026-11-01 | 3 min | Phone: back gesture / swipe on the list opens the folder screen |
| v0.6.1 | 2026-11-01 | 3 min | Myojin sheet link saved |
| v0.6.0 | 2026-11-01 | 5 min | Google Sheets view (SHEETS section) |
| v0.5.5 | 2026-11-01 | 4 min | Smaller folder list on PC, flat folder icons |
| v0.5.4 | 2026-11-01 | 3 min | Bigger A- / A+ text-size steps |
| v0.5.3 | 2026-11-01 | 1 min | Full-width text in PC full screen |
| v0.5.2 | 2026-11-01 | 4 min | Resizable panes on PC |
| v0.5.0 | 2026-11-01 | 2 min | Install on PC, app icon, keyboard shortcuts |
| v0.4.4 | 2026-11-01 | 4 min | Full-width landscape reading |
| v0.4.2 | 2026-11-01 | 1 min | Swipe to leave full screen |
| v0.4.0–0.4.1 | 2026-11-01 | 6 min | 🔊 read aloud via Text Reader, hide address bar on phones |
| v0.3.3 | 2026-11-01 | 1 min | Pink Inbox |
| v0.3.2 | 2026-11-01 | 3 min | Medium-size folder list |
| v0.3.1 | 2026-11-01 | 3 min | Phones always load the newest version |
| v0.3.0 | 2026-11-01 | 22 min | Swipe back from email, bigger folder list |
| — | 2026-11-01 | 16 min | Test checklist (QA.md), GitHub Pages setup |
| v0.2.0 | 2026-11-01 | 1 min | Reading mode, text size, full screen |
| v0.1.0 | 2026-11-01 | 3 min | First version: dark read-only Gmail reader with demo mode |
| **Total** | | **2 h 25 min** | |

Time = clock time from the previous release to this one (includes waiting and testing).
Add a new row at the top of this table for every release, and update the total.

---

## v0.9.0 — 2026-11-04 — time spent: 6 min

**What changed**
- Sheets now show the sheet's own formatting: cell background colors, text colors, bold / italic / underline / strike-through, left-center-right alignment, merged cells, column widths. Conditional-format colors are included.
- White (uncolored) cells stay dark to match the app; any color you set is shown as-is. Dark text colors are brightened so they can be read on dark.
- Empty rows/columns at the end are cut off.
- Same read-only permission; nothing new to approve.

**Why**
- The Pairs tab looked plain; the original sheet's colors make it easier to read.

## v0.8.3 — 2026-11-04 — time spent: 4 min

**What changed**
- Camera-side gap is now at most 10px extra (was the full width Android reports, about a thumb wide on Pixel 10).

**Why**
- Pixel's camera is a small dot; the big gap wasted space in landscape.

## v0.8.2 — 2026-11-04 — time spent: 8 min

**What changed**
- Phone sideways: the email now fills the whole width, also next to the camera. Only the text is moved away from the camera side (and moves again when you rotate).
- Player bar and full-screen ✕ button also stay clear of the camera.

**Why**
- In landscape full screen there was a blank black strip on the camera side.

## v0.8.1 — 2026-11-04 — time spent: 5 min

**What changed**
- Errors now show Google's own reason (e.g. API not enabled / no permission / no access to the file).
- If you signed in without ticking "See your Google Sheets", the Sheets view says so and how to fix it.

**Why**
- Myojin sheet showed "Sheets error 403" without saying why.

## v0.8.0 — 2026-11-04 — time spent: 5 min

**What changed**
- Google Client ID added to `config.js`. Demo mode is off: tap **Sign in** to see your real Gmail and the Myojin sheet.
- Google Cloud project "AtsuMail" set up: Gmail API + Google Sheets API on, read-only permissions, app "In production" (unverified, personal use).

**Why**
- Read real email in AtsuMail.

## v0.7.3 — 2026-11-04 — time spent: 10 min

**What changed**
- Added `privacy.html` (privacy policy): read-only, runs only in your browser, no server, no data shared.

**Why**
- Google requires a home page and privacy policy link before the app can be switched to "In production" (needed because Google would not accept the Gmail address as a test user).

## v0.7.2 — 2026-11-01 — time spent: 11 min

**What changed**
- While the voice reads, the current sentence is highlighted in **light blue** and the email scrolls to keep it in view.
- While the player is open, **tap/click any sentence** in the email to read from there.
- Changing text size or Aa while reading keeps your place.
- Esc and F now work even after clicking inside the email.
- Technical: the email frame is now "same origin" so the app can find sentences in it. The email's own scripts still cannot run (no `allow-scripts`).

**Why**
- Easier to follow along while listening.

## v0.7.0 — 2026-11-01 — time spent: 7 min

**What changed**
- 🔊 now opens a **built-in voice player** at the bottom of the email (no Text Reader app needed):
  - ▶ / ❚❚ play-pause, ⏮ ⏭ previous/next sentence, ■ stop, − / + speed, pink progress bar, current sentence shown.
  - Styles: **Soft** (slower, lower, longer pauses), **Radio DJ** (quicker, brighter, short pauses), **News**.
  - Reads English and Japanese in the same email: switches voice per sentence.
  - Picks the most natural voice on your device automatically (Edge "Online (Natural)", iPhone "Premium/Enhanced", Google). You can change EN/JA voice. All settings remembered.
  - ↗ button still sends the email to your Text Reader app.
- Removed Ctrl+F shortcut. Only **F** toggles full screen (Ctrl+F is the browser's Find again).
- New file: `voice.js`.

**Why**
- Test listening to emails inside AtsuMail. Free: uses voices already on your device.

## v0.6.4 — 2026-11-01 — time spent: 2 min

**What changed**
- PC: the plain **F** key also turns full screen on/off while an email is open (like YouTube). Ctrl+F still works too.

**Why**
- One key, and it won't clash with the browser's Find (useful later for searching).

## v0.6.3 — 2026-11-01 — time spent: 2 min

**What changed**
- PC: **Ctrl+F** turns full screen on/off while an email is open. Esc also leaves full screen.
- When no email is open, Ctrl+F is the browser's normal "Find".

**Why**
- Faster than clicking the small ⛶ button.

## v0.6.2 — 2026-11-01 — time spent: 3 min

**What changed**
- Phone: on the email list, the phone's own back gesture (or swipe from the left edge) now opens the folder screen instead of leaving AtsuMail. Do it again to close the folders.
- Swiping left-to-right on the list still opens folders too.

**Why**
- Swiping near the left edge was caught by the phone as "back" and could close the app.

## v0.6.1 — 2026-11-01 — time spent: 3 min

**What changed**
- Myojin sheet link saved in `config.js`. It shows after Google sign-in is set up; demo mode keeps showing the fake sheet.

**Why**
- Ready for when Gmail/Google is connected.


## v0.6.0 — 2026-11-01 — time spent: 5 min

**What changed**
- New **SHEETS** section at the bottom of the folder list. Shows Google Sheets (read-only) in a dark, Excel-like grid: column letters, row numbers, first row bold, numbers right-aligned, tabs at the bottom.
- Sheets are set in `config.js` → `SHEETS` (name + link). "Myojin" is ready; paste its link.
- Sign-in now also asks for "read your Google Sheets" (`spreadsheets.readonly`). Needs the Google Sheets API turned on (README).
- ↻ refreshes the open sheet.
- Phone: tap a cut-off cell to see its full text.
- Demo: fake "Myojin" sheet with 2 tabs.

**Why**
- See the Myojin sheet in the same app as email.


## v0.5.5 — 2026-11-01 — time spent: 4 min

**What changed**
- PC: folder list text is smaller (13px) and the panel is narrower by default (180px). Phone keeps the bigger size for easy tapping.
- Folder icons are now flat drawn icons (Explorer style) instead of the 📁 emoji. Inbox icon is pink to match its name.

**Why**
- Cleaner, more professional look on PC.


## v0.5.4 — 2026-11-01 — time spent: 3 min

**What changed**
- A- / A+ now jump in clear steps (11 sizes: 12px to 38px) instead of 1px at a time.
- A small blue note "Text size 6 / 11" shows for a second after each tap.

**Why**
- 1px steps were too small to notice, so the buttons looked broken.


## v0.5.3 — 2026-11-01 — time spent: 1 min

**What changed**
- Reading mode text now uses the full width everywhere (removed the PC line-width limit).
- Full screen on PC also hides the resize bars.

**Why**
- Full screen on PC showed empty space on the sides.


## v0.5.2 — 2026-11-01 — time spent: 4 min

**What changed**
- PC: drag the thin dividers to resize panes (like Windows Explorer):
  - between folders and the email list
  - between the email list and the open email
  - double-click a divider to reset; sizes are remembered.
- When the email list is narrow, each email shows on 2 lines (sender + date, then subject).

**Why**
- Make the reading pane as wide as you like on PC.


## v0.5.0 — 2026-11-01 — time spent: 2 min

**What changed**
- Installable on Windows PC (Edge/Chrome → Install AtsuMail): own window, Start menu, taskbar icon.
- App icon (pink envelope on dark, blue strip) for PC, Android and iPhone Home Screen.
- PC keyboard: ↑/↓ opens previous/next email, Esc closes it.

**Why**
- Use the same app on PC and phone, one code base, free.


## v0.4.4 — 2026-11-01 — time spent: 4 min

**What changed**
- Landscape (phone on its side) now uses the phone layout: the email fills the full width, no empty side space.
- While reading sideways, the top toolbar hides; only one thin bar stays, with a ← button.
- Reading mode only limits line width on big PC screens (1000px+), not on phones. (Removed in v0.5.3.)
- Text stays clear of the iPhone notch/rounded corners when sideways.

**Why**
- Landscape showed the PC layout (folders + list + email) and wasted space.


## v0.4.2 — 2026-11-01 — time spent: 1 min

**What changed**
- In full screen, swiping from the right edge to the left (or the phone's back gesture) first returns to the normal email screen. Swipe again to go back to the list.

**Why**
- Faster than finding the small ✕ button.


## v0.4.0 / v0.4.1 — 2026-11-01 — time spent: 6 min

**What changed**
- 🔊 button on an open email: sends the email text to Text Reader (`../text_reader/`) and opens it in a new tab. Tap PLAY there to listen. Web addresses and images are left out.
- Needs Text Reader v8.1.7 or newer and its GitHub Pages turned on.
- Demo: added a Japanese email magazine for testing voice.
- Phones: opening an email now hides the browser's address bar (Android Chrome). On iPhone, open AtsuMail from the Home Screen icon instead; there is no address bar there.

**Why**
- Listen to email magazines without copy-paste.
- More of the screen for the email text.


## v0.3.3 — 2026-11-01 — time spent: 1 min

**What changed**
- "Inbox" folder name is pink (`#ff8fd1`), also when selected.

**Why**
- Personal style; makes Inbox easy to spot.

## v0.3.2 — 2026-11-01 — time spent: 3 min

**What changed**
- Folder text is now medium size (20px, was 26px; original was 13px). Folder panel width 240px on PC.

**Why**
- 2x was too big; this sits between the first size and the 2x size.

## v0.3.1 — 2026-11-01 — time spent: 3 min

**What changed**
- Added a version tag (`?v=0.3.1`) to the style and script links in `index.html`. Change it on every release.

**Why**
- Phones kept showing the old version for up to 10 minutes after an update (saved copy). A new tag forces a fresh download.

## v0.3.0 — 2026-11-01 — time spent: 22 min

**What changed**
- Swipe to go back from an email to the list:
  - Start at the **right edge** of the email and swipe **to the left** (main gesture).
  - Or start at the left edge and swipe right.
  - Or swipe sideways on the thin info bar at the top of the email.
  - The phone's own back gesture/button also closes the email now (instead of leaving the app).
- In the list: swipe right to show folders, swipe left to hide them.
- Folder list is bigger (see v0.3.2 for final size), easier to tap.
- Fix: opening several emails no longer adds extra hidden "back" steps.

**Why**
- Tapping the small back button on a phone is slow; swiping is faster with one hand.
- Folder names were too small to tap comfortably.

## v0.2.0 — 2026-11-01 — time spent: 1 min

**What changed**
- Reading mode (`Aa`, on by default): strips newsletter colors and layout, shows one dark column with large serif text, removes invisible tracking pixels.
- Text size buttons `A-` / `A+` (also zoom the original design when reading mode is off).
- Full screen button `⛶`: hides all bars; faint `✕` button to exit.
- Settings are remembered on the device.
- Demo: added a long magazine-style newsletter to test with.

**Why**
- Main use is reading long email magazines on a phone, so the text should fill the whole screen and be comfortable to read in dark mode.

## v0.1.0 — 2026-11-01 — time spent: 3 min

**What changed**
- First version: read-only Gmail reader that runs in the browser.
- Folder tree from Gmail labels (system folders first, then your own, with sub-folders).
- Explorer-style "Details" list: From / Subject / Date, unread in bold, "Load more" button.
- Reader view: one thin info line, then the email fills the rest of the screen. On phones the list hides while reading.
- Dark mode, Windows Explorer look, blue status bar.
- Demo mode with fake emails when no Client ID is set.
- Can be added to the phone home screen (manifest.json).

**Why**
- Gmail's app wastes space; the goal is maximum email content on a phone screen.
- Started read-only so nothing can be broken or deleted by mistake while learning.

## Ideas for later
- Stay signed in longer (needs a small free server, e.g. Cloudflare Workers).
- Mark as read / archive / delete (needs a bigger Gmail permission).
- Search box.
- "Force dark" switch for designed emails.
- Reply / compose.
- Store release (later): Google Play $25 once, Apple $99/year, plus Google's verification of the Gmail permission for public users (can require a paid security check if mail passes through a server).
