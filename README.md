# AtsuMail

A tiny, old-school, dark-mode Gmail **reader**. Made for phones: when you open an email, almost the whole screen is the email.

- Looks like Windows Explorer: folders on the left, a "Details" list, a blue status bar.
- Shows your real Gmail folders (Gmail calls them "labels"), including sub-folders like `Trading/Broker`.
- **Read-only** for now: it can read mail, but cannot send, delete or change anything.
- Runs 100% in your browser. There is no server, so your mail is never stored anywhere else.
- Free: hosted on GitHub Pages, Gmail API is free for personal use.

## Reading buttons (top right of an open email)

| Button | What it does |
|---|---|
| `A-` / `A+` | Smaller / bigger text. Remembered for next time. |
| `Aa` | **Reading mode** (blue = on). Removes the newsletter's colors and columns and shows clean dark text in one column. Tap again to see the original design. Remembered for next time. |
| `🔊` | **Read aloud**: opens your Text Reader app with this email filled in. Tap PLAY there. |
| `⛶` | **Full screen**. Hides every bar, so only the email is on screen. Tap the faint `✕` at the bottom right to come back. |

## Files

| File | What it does |
|---|---|
| `index.html` | The page layout |
| `style.css` | The dark Explorer look |
| `app.js` | Talks to Gmail and shows the mail |
| `config.js` | Your settings (Google Client ID goes here) |
| `demo.js` | Fake emails, used when no Client ID is set |
| `manifest.json` + `icon-*.png` | Lets you install it on PC or add it to your phone's Home Screen, with its own icon |
| `QA.md` | Test checklist to run after every new version |

## Try it (demo mode, no Google needed)

1. Open the site (see "Put it online" below), or on your PC run this in the project folder:
   ```
   python -m http.server 8000
   ```
2. Open `http://localhost:8000` in your browser.
3. Success = you see folders and 4 fake emails. The button at top right says **Demo mode**.

## Connect your real Gmail (one-time setup, ~15 minutes, free)

Words you'll see:
- **Google Cloud project**: a free "box" in Google's website that holds your app's settings.
- **OAuth**: the "Sign in with Google" popup. You log in on Google's own page, so AtsuMail never sees your password.
- **Client ID**: a public name for your app. It is *not* a secret.

Steps:
1. Go to https://console.cloud.google.com and sign in with your Gmail account.
2. Top bar → project picker → **New Project** → name it `AtsuMail` → **Create**.
3. Search bar at top: type `Gmail API` → click it → **Enable**. Then search `Google Sheets API` → click it → **Enable**.
4. Search bar: type `Google Auth Platform` (or "OAuth consent screen") → **Get started**.
   - App name: `AtsuMail`, support email: your email.
   - Audience: **External**.
   - Finish the wizard.
5. In **Audience** → **Test users** → **Add users** → add your own Gmail address.
6. In **Data Access** → **Add or remove scopes** → tick these two → **Update** → **Save**:
   - `.../auth/gmail.readonly` (read your mail)
   - `.../auth/spreadsheets.readonly` (read your Google Sheets)
7. In **Clients** → **Create client**:
   - Application type: **Web application**
   - Authorized JavaScript origins: add `https://anishimori123.github.io` (and `http://localhost:8000` for testing on your PC)
   - Click **Create**. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).
   - Ignore the "Client secret". Don't put it anywhere.
8. Open `config.js` and paste the Client ID between the quotes in `CLIENT_ID: ""`.
9. Open AtsuMail → click **Sign in**.
   - Google will say **"Google hasn't verified this app"**. That's normal because it's your own private app. Click **Continue**.
   - Success = your real folders and emails appear.

## Show a Google Sheet (like your Myojin sheet)

1. Open the sheet in your browser. Copy the address from the address bar (it looks like `https://docs.google.com/spreadsheets/d/1AbC.../edit`).
2. On GitHub, open `config.js` → click the ✏️ pencil (Edit).
3. Paste the link between the quotes in `{ name: "Myojin", url: "" }`.
4. Click **Commit changes**.
5. In AtsuMail, the sheet is under **SHEETS** at the bottom of the folder list. Tabs are at the bottom of the sheet, like Excel.
- Read-only: you can look, not edit.
- To add another sheet, add another line: `{ name: "Budget", url: "..." },`

## Put it online (GitHub Pages, free)

1. On GitHub open the repo → **Settings** → **Pages**.
2. Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)` → **Save**.
3. Wait 1–2 minutes. Your app is at `https://anishimori123.github.io/AtsuMail/`.
4. On your phone, open that link → browser menu → **Add to Home Screen**.

## Install on your Windows PC (free, like a real program)

1. Open `https://anishimori123.github.io/AtsuMail/` in **Edge** or **Chrome**.
2. Edge: click **⋯** (top right) → **Apps** → **Install AtsuMail**.
   Chrome: click the small **install icon** (a screen with a down arrow) at the right end of the address bar → **Install**.
3. Success = AtsuMail opens in its own window with the pink envelope icon, and shows up in the Start menu. Right-click its taskbar icon → **Pin to taskbar**.

PC keyboard: `↑` / `↓` = previous / next email, `Esc` = close email.

PC resizing: drag the thin bars between the panes (they turn blue). Double-click a bar to reset.

## Known limits

- You'll need to tap **Sign in** again about every hour (Google's sign-in for browser-only apps lasts 1 hour). Fixing this needs a small server; see CHANGELOG ideas.
- On iPhone, the browser itself can't go fully full screen. Use **Add to Home Screen**: then the Safari bars disappear too.
- Reading mode is great for newsletters but can make receipts or emails with data tables look odd. Tap `Aa` to see the original.

## Can I put this in the App Store / Google Play?

Possible, but not free and not quick. See the "Store" notes in CHANGELOG ideas. For now it's a private app for your own account (Google allows up to 100 "test users" you add yourself, free).
- Images inside emails load from the sender's server (same as Gmail). Senders can see that you opened the email.
