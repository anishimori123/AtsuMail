# AtsuMail test checklist

Do this after every new version. ~10 minutes. Test on your **phone** first (that's the main use), then PC.
If something fails, write: **test number + what you saw + a screenshot**. That's all I need to fix it.

## Part A — Demo mode (no Google needed)
1. Open the app. You see `Demo mode` at top right and 5 emails in Inbox.
2. Phone: tap `☰`. The folder list slides in. Tap `Sent`. It shows 1 email and the folder list closes.
3. Go back to Inbox. Tap **The Weekly Market Letter**. It opens with dark background, big text, one column.
4. Tap `A+` three times. Text gets clearly bigger each time and a blue note shows the size (e.g. "Text size 7 / 11"). Tap `A-` to go back.
5. Tap `Aa`. You see the original beige design. Tap `Aa` again. Back to dark.
6. Tap `⛶`. Only the email is on screen. Scroll to the bottom. Tap the faint `✕` bottom right. Bars come back.
7. Close the app and open it again. Open the same email. Text size and `Aa` setting are remembered.
8. Tap `←`. You are back at the list.
9. Tap the link "Read on the web" in the newsletter. It opens in a new tab (not inside the app).
9a. Open an email. Put your finger on the **right edge** of the screen and swipe **left**. You are back at the list.
9b. Open an email. Use your phone's normal back gesture (Android) or the left-edge swipe (iPhone). You are back at the list, and still inside AtsuMail.
9d. Open the Japanese newsletter (週刊マーケット通信). Tap 🔊. Text Reader opens with the text filled in and the PLAY button shows the subject. Tap PLAY. You hear it read aloud.
9e. Android: opening an email hides the address bar. Going back to the list shows it again.
9f. Open an email, tap ⛶. Swipe from the right edge to the left: back to the normal email screen. Swipe again: back to the list.
9g. Turn the phone sideways and open an email. It fills the full width with one thin bar on top. Tap ← in that bar to go back.
9i. On the list, use the phone's back gesture (swipe in from the left edge). The folder screen opens (the app does NOT close). Do it again: folders close.
9c. On the list, swipe right. Folders slide in, with big text. Swipe left. They hide.
9h. In the folder list, under SHEETS, tap **Myojin**. A dark table shows with tabs at the bottom (Sheet1, Log). Tap **Log**: it switches. Tap **Inbox**: back to email.

## Part B — Real Gmail (after you add your Client ID)
10. Tap `Sign in` → choose your account → "unverified app" warning → `Continue` → allow. Your folders appear.
11. Your own Gmail labels show, with sub-folders indented.
12. Inbox shows your latest 50 emails, newest first, unread in bold. Scroll down → `Load more` works.
13. Open 3 real email magazines. Reading mode looks clean? Note any that look broken (sender name + screenshot).
14. Open 1 receipt/order email. If reading mode looks odd, `Aa` shows the original correctly.
15. Open a Japanese email. Japanese text shows correctly (no garbled letters).
16. Wait over 1 hour, tap `↻`. You'll see "Session expired". Tap `Sign in` again and it works. (This is expected for now.)
16a. Tap **Myojin** (link already saved in config.js). Your real sheet shows, with all its tabs.
17. Phone: Add to Home Screen, open from the icon. No browser bars.

## Part C — PC (Windows, Edge or Chrome)
18. Open the link on PC. You see folders on the left, list in the middle.
19. Click an email: it opens on the right. Press ↓ / ↑: next / previous email opens. Press Esc: it closes.
20. Install it (README "Install on your Windows PC"). It opens in its own window with the pink envelope icon.
21. Open an email on PC. Drag the thin bar between the list and the email left/right: the email gets wider/narrower. Close and reopen the app: the size is remembered. Double-click the bar: back to normal.
22. Drag the bar between folders and list. Same behavior.
