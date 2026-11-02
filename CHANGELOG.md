# Changelog

## v0.3.0 — 2026-11-01 — time spent: ~20 min

**What changed**
- Swipe to go back from an email to the list:
  - Start at the **right edge** of the email and swipe **to the left** (main gesture).
  - Or start at the left edge and swipe right.
  - Or swipe sideways on the thin info bar at the top of the email.
  - The phone's own back gesture/button also closes the email now (instead of leaving the app).
- In the list: swipe right to show folders, swipe left to hide them.
- Folder list is 2x bigger (text 26px, more space between folders), easier to tap.
- Fix: opening several emails no longer adds extra hidden "back" steps.

**Why**
- Tapping the small back button on a phone is slow; swiping is faster with one hand.
- Folder names were too small to tap comfortably.

## v0.2.0 — 2026-11-01 — time spent: ~20 min

**What changed**
- Reading mode (`Aa`, on by default): strips newsletter colors and layout, shows one dark column with large serif text, removes invisible tracking pixels.
- Text size buttons `A-` / `A+` (also zoom the original design when reading mode is off).
- Full screen button `⛶`: hides all bars; faint `✕` button to exit.
- Settings are remembered on the device.
- Demo: added a long magazine-style newsletter to test with.

**Why**
- Main use is reading long email magazines on a phone, so the text should fill the whole screen and be comfortable to read in dark mode.

## v0.1.0 — 2026-11-01 — time spent: ~30 min

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
