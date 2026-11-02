// AtsuMail settings.
// Paste your Google OAuth "Client ID" between the quotes below.
// It looks like: 1234567890-abcdefg.apps.googleusercontent.com
// A Client ID is NOT a secret (it is public, like a username), so it is safe to keep here.
// NEVER put a "Client secret" in this file. This app does not need one.
// Leave it empty ("") to run in DEMO mode with fake emails.
window.ATSU_CONFIG = {
  CLIENT_ID: "",
  // Read-only access: the app can read your mail and sheets but cannot send, delete or change anything.
  SCOPE: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/spreadsheets.readonly",
  PAGE_SIZE: 50,
  // Your voice app. "../text_reader/" means "the text_reader site next to AtsuMail".
  VOICE_URL: "../text_reader/",
  // Google Sheets shown under "Sheets" in the folder list.
  // Paste the sheet's link (copy it from the browser address bar while the sheet is open).
  // You can add more lines like: { name: "Budget", url: "https://docs.google.com/spreadsheets/d/..." },
  SHEETS: [
    { name: "Myojin", url: "https://docs.google.com/spreadsheets/d/1tOl09Ill4jKm9hig-9r-oT2gvQVX_Dwg7Z9WKoGEglM/edit" }
  ]
};
