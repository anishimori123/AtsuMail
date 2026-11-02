# Changelog

## Summary

| Version | Date | Time | What changed |
|---|---|---|---|
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
| **Total** | | **1 h 27 min** | |

Time = clock time from the previous release to this one (includes waiting and testing).
Add a new row at the top of this table for every release, and update the total.

---

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
