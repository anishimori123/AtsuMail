// AtsuMail debug log. Loaded first, so it can catch problems in every other file.
// Everything stays in this browser (last 500 lines). Open it with the 🐞 button.
//
// What it records:
//  - errors in the app (with file and line)
//  - what the app was doing (opened email, voice sentence 34/120, ...)
//  - memory use every 10 seconds (Chrome only)
//  - if AtsuMail closed without you closing it ("unexpected close"), on the next start
window.AtsuLog = (() => {
  const KEY = "atsu.log", ALIVE = "atsu.alive", MAX = 500;
  let lines = [];
  try { lines = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { lines = []; }
  let state = "starting", saveT = null;

  const now = () => {
    const d = new Date(), p = (n, w = 2) => String(n).padStart(w, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  const mem = () => (performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB" : "");
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(lines.slice(-MAX))); } catch {} }
  function add(kind, msg) {
    lines.push({ t: now(), k: kind, m: String(msg).slice(0, 600) });
    if (lines.length > MAX) lines = lines.slice(-MAX);
    clearTimeout(saveT); saveT = setTimeout(persist, 300);
    if (kind === "error" || kind === "crash") { persist(); try { window.dispatchEvent(new Event("atsu-log-alert")); } catch {} }
  }

  // ---- Did the last session end without closing normally? ----
  try {
    const last = JSON.parse(localStorage.getItem(ALIVE) || "null");
    if (last && !last.clean) {
      const where = last.visible ? "while it was ON SCREEN" : "while it was in the background (screen off or another app)";
      const guess = last.visible
        ? "Likely a real crash (page error or the phone ran out of memory for this tab)."
        : "Usually Android closing a background tab to save battery/memory.";
      add("crash", `Last session ended unexpectedly ${where}. Last seen ${last.t}. It was doing: ${last.state || "?"}. Memory then: ${last.mem || "n/a"}. ${guess}`);
    }
  } catch {}

  // ---- Heartbeat: remember what the app is doing, every 10 seconds ----
  let lastMemLog = 0, closing = false;
  function beat(clean) {
    if (clean) closing = true;
    try {
      localStorage.setItem(ALIVE, JSON.stringify({ t: now(), state, mem: mem(), visible: document.visibilityState === "visible", clean: closing }));
    } catch {}
    if (Date.now() - lastMemLog > 120000 && mem()) { lastMemLog = Date.now(); add("memory", mem() + " · " + state); }
  }
  setInterval(() => beat(false), 10000);
  // pagehide = you closed / left the page normally
  addEventListener("pagehide", () => { add("info", "page closed normally"); persist(); beat(true); });
  addEventListener("pageshow", (e) => { if (e.persisted) { closing = false; add("info", "page restored"); beat(false); } });
  document.addEventListener("visibilitychange", () => {
    add("info", document.visibilityState === "visible" ? "app back on screen" : "app went to background (screen off / switched app)");
    beat(false);
  });

  // ---- Catch errors ----
  addEventListener("error", (e) => {
    const where = e.filename ? ` @ ${e.filename.split("/").pop()}:${e.lineno}:${e.colno}` : "";
    const stack = e.error && e.error.stack ? " | " + e.error.stack.split("\n").slice(1, 3).map((s) => s.trim()).join(" < ") : "";
    add("error", (e.message || "unknown error") + where + stack);
  });
  addEventListener("unhandledrejection", (e) => {
    const r = e.reason; add("error", "promise: " + (r && (r.message || r.toString()) || "unknown"));
  });

  const ua = navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 160);
  add("start", `AtsuMail opened · ${ua} · screen ${screen.width}x${screen.height} · memory ${mem() || "n/a"}`);
  beat(false);

  function text() {
    return "AtsuMail debug log (newest last)\n" + lines.map((l) => `${l.t} [${l.k}] ${l.m}`).join("\n");
  }
  return {
    add,
    state: (s) => { state = s; },
    lines: () => lines.slice(),
    text,
    clear: () => { lines = []; persist(); add("info", "log cleared"); }
  };
})();
