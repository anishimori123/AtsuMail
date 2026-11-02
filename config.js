// AtsuMail settings.
// Paste your Google OAuth "Client ID" between the quotes below.
// It looks like: 1234567890-abcdefg.apps.googleusercontent.com
// A Client ID is NOT a secret (it is public, like a username), so it is safe to keep here.
// NEVER put a "Client secret" in this file. This app does not need one.
// Leave it empty ("") to run in DEMO mode with fake emails.
window.ATSU_CONFIG = {
  CLIENT_ID: "",
  // Read-only access: the app can read your mail but cannot send, delete or change anything.
  SCOPE: "https://www.googleapis.com/auth/gmail.readonly",
  PAGE_SIZE: 50
};
