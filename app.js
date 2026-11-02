// AtsuMail - a tiny, read-only Gmail reader. Runs fully in your browser.
(() => {
  const CFG = window.ATSU_CONFIG || {};
  const DEMO = !CFG.CLIENT_ID;
  const API = "https://gmail.googleapis.com/gmail/v1/users/me";
  const $ = (id) => document.getElementById(id);

  let token = null, tokenClient = null;
  let curLabel = "INBOX", nextPage = null, curMsgId = null;
  const SYS_ORDER = ["INBOX", "STARRED", "IMPORTANT", "SENT", "DRAFT", "SPAM", "TRASH"];

  const status = (t) => ($("status").textContent = t);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const prettyName = (n) => (SYS_ORDER.includes(n) ? n[0] + n.slice(1).toLowerCase() : n);

  function shortDate(ms) {
    const d = new Date(ms), now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: "short", day: "numeric" });
    return d.toLocaleDateString([], { year: "2-digit", month: "numeric", day: "numeric" });
  }
  const fromName = (f) => (f || "").replace(/<.*>/, "").replace(/"/g, "").trim() || f;

  // ---------- Google sign-in ----------
  function initAuth() {
    if (DEMO) { $("btnSignIn").textContent = "Demo mode"; $("btnSignIn").disabled = true; status("DEMO mode - add your Client ID in config.js to see real mail"); loadAll(); return; }
    if (!window.google?.accounts?.oauth2) { setTimeout(initAuth, 200); return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CFG.CLIENT_ID, scope: CFG.SCOPE,
      callback: (r) => {
        if (r.error) { status("Sign-in failed: " + r.error); return; }
        token = r.access_token;
        $("btnSignIn").textContent = "Signed in";
        loadAll();
      }
    });
    status("Click Sign in to connect Gmail");
  }

  async function gapi(path) {
    if (!token) throw new Error("Not signed in");
    const r = await fetch(API + path, { headers: { Authorization: "Bearer " + token } });
    if (r.status === 401) { token = null; $("btnSignIn").textContent = "Sign in"; throw new Error("Session expired - click Sign in again"); }
    if (!r.ok) throw new Error("Gmail error " + r.status);
    return r.json();
  }

  // ---------- Folders (Gmail labels) ----------
  async function loadLabels() {
    let labels;
    if (DEMO) labels = ATSU_DEMO.labels;
    else {
      const res = await gapi("/labels");
      const hide = /^(CATEGORY_|CHAT$|UNREAD$)/;
      labels = res.labels.filter((l) => !hide.test(l.id)).map((l) => ({ id: l.id, name: l.name, type: l.type }));
      // unread count for inbox only (keeps it fast)
      try { const ib = await gapi("/labels/INBOX"); const L = labels.find((l) => l.id === "INBOX"); if (L) L.unread = ib.messagesUnread; } catch {}
    }
    const sys = labels.filter((l) => l.type === "system").sort((a, b) => SYS_ORDER.indexOf(a.id) - SYS_ORDER.indexOf(b.id));
    const user = labels.filter((l) => l.type !== "system").sort((a, b) => a.name.localeCompare(b.name));
    $("folders").innerHTML = [...sys, ...user].map((l) => {
      const depth = l.type === "system" ? 0 : l.name.split("/").length - 1;
      const name = l.type === "system" ? prettyName(l.name) : l.name.split("/").pop();
      return `<div class="folder ${depth ? "sub" : ""} ${l.id === curLabel ? "sel" : ""}" style="${depth > 1 ? `padding-left:${10 + depth * 20}px` : ""}" data-id="${esc(l.id)}" data-name="${esc(l.type === "system" ? prettyName(l.name) : l.name)}">${esc(name)}${l.unread ? ` <span class="n">(${l.unread})</span>` : ""}</div>`;
    }).join("");
  }

  // ---------- Message list ----------
  const header = (m, n) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === n)?.value || "";

  async function loadList(more = false) {
    if (!more) { $("rows").innerHTML = ""; nextPage = null; }
    status("Loading...");
    let items;
    if (DEMO) {
      items = ATSU_DEMO.messages.filter((m) => m.labels.includes(curLabel)).map((m) => ({ id: m.id, from: m.from, subject: m.subject, snippet: m.snippet, date: m.date, unread: m.unread }));
    } else {
      const q = `?labelIds=${encodeURIComponent(curLabel)}&maxResults=${CFG.PAGE_SIZE || 50}` + (more && nextPage ? `&pageToken=${nextPage}` : "");
      const res = await gapi("/messages" + q);
      nextPage = res.nextPageToken || null;
      const ids = (res.messages || []).map((m) => m.id);
      items = await Promise.all(ids.map(async (id) => {
        const m = await gapi(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
        return { id, from: header(m, "from"), subject: header(m, "subject"), snippet: decodeEntities(m.snippet), date: +m.internalDate, unread: (m.labelIds || []).includes("UNREAD") };
      }));
    }
    $("rows").insertAdjacentHTML("beforeend", items.map((m) =>
      `<div class="row ${m.unread ? "unread" : ""}" data-id="${m.id}">
        <span class="c-from">${esc(fromName(m.from))}</span>
        <span class="c-date">${shortDate(m.date)}</span>
        <span class="c-subj">${esc(m.subject || "(no subject)")} <small>- ${esc(m.snippet)}</small></span>
      </div>`).join(""));
    $("btnMore").hidden = !nextPage;
    status(`${$("rows").children.length} items`);
  }
  function decodeEntities(s) { const t = document.createElement("textarea"); t.innerHTML = s || ""; return t.value; }

  // ---------- Reading an email ----------
  function b64(data) {
    const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  function findPart(p, type) {
    if (!p) return null;
    if (p.mimeType === type && p.body?.data) return b64(p.body.data);
    for (const c of p.parts || []) { const r = findPart(c, type); if (r) return r; }
    return null;
  }

  async function openMsg(id) {
    curMsgId = id;
    document.querySelectorAll(".row.sel").forEach((r) => r.classList.remove("sel"));
    document.querySelector(`.row[data-id="${id}"]`)?.classList.add("sel", "read");
    document.querySelector(`.row[data-id="${id}"]`)?.classList.remove("unread");
    status("Opening...");
    let from, subject, date, html, text;
    if (DEMO) {
      const m = ATSU_DEMO.messages.find((x) => x.id === id);
      ({ from, subject, date, html, text } = m);
    } else {
      const m = await gapi(`/messages/${id}?format=full`);
      from = header(m, "from"); subject = header(m, "subject"); date = +m.internalDate;
      html = findPart(m.payload, "text/html"); text = findPart(m.payload, "text/plain");
    }
    // One thin line of info, so the email body gets almost all the screen.
    $("meta").innerHTML = `<b>${esc(fromName(from))}</b> &middot; ${esc(subject || "(no subject)")} <span class="d">&middot; ${new Date(date).toLocaleString()}</span>`;
    $("meta").title = `${from}\n${subject}`;
    cur = { html, text, subject, from };
    render();
    if (!(history.state && history.state.atsuRead)) history.pushState({ atsuRead: 1 }, "");
    $("reader").hidden = false;
    autoHideBrowserBar();
    document.body.classList.add("reading");
    $("btnBack").hidden = false;
    status("Ready");
  }

  // ---------- Reading mode, text size, full screen ----------
  let cur = { html: "", text: "" };
  const load = (k, d) => { try { const v = localStorage.getItem("atsu." + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem("atsu." + k, JSON.stringify(v)); } catch {} };
  let readMode = load("readMode", true);   // true = dark, clean, one column (best for long newsletters)
  let fontPx = load("fontPx", 17);

  // Strip the newsletter's own colors and layout, keep text, links, images.
  function cleanHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("style,script,link,meta,title,noscript,svg,form,input,button").forEach((e) => e.remove());
    doc.querySelectorAll("img").forEach((i) => {
      const w = +i.getAttribute("width"), h = +i.getAttribute("height");
      if ((w && w < 5) || (h && h < 5)) i.remove(); // invisible tracking pixels
    });
    doc.body.querySelectorAll("*").forEach((e) => {
      for (const a of [...e.attributes]) if (!["href", "src", "alt", "colspan", "rowspan"].includes(a.name)) e.removeAttribute(a.name);
    });
    return doc.body.innerHTML;
  }

  function render() {
    const { html, text } = cur;
    const base = `<base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1">`;
    const dark = `<style>
      html{background:#1e1e1e;color:#ddd}
      body{margin:0 auto;padding:10px 12px 60px;max-width:42em;font:${fontPx}px/1.6 Georgia,"Times New Roman",serif;word-wrap:break-word;overflow-wrap:anywhere}
      a{color:#6cb6ff} h1,h2,h3,h4,b,strong{color:#fff;line-height:1.3}
      img{max-width:100%!important;height:auto!important;display:block;margin:8px auto}
      table,tbody,thead,tr,td,th,center{display:block;width:auto!important}
      hr{border:0;border-top:1px solid #444}
      .plain{white-space:pre-wrap;font-family:inherit}</style>`;
    let doc;
    if (!html) doc = base + dark + `<div class="plain">${esc(text || "(empty)")}</div>`;
    else if (readMode) doc = base + dark + cleanHtml(html);
    else doc = base + `<style>html{background:#fff;color:#111;zoom:${fontPx / 17}}
      body{margin:8px;font-family:-apple-system,Segoe UI,Arial,sans-serif}
      img{max-width:100%;height:auto} table{max-width:100%!important}</style>` + html;
    // Use a fresh frame each time: changing an existing frame adds hidden
    // "back" steps to the browser history, which breaks the back swipe.
    const old = $("body"), fr = old.cloneNode(false);
    fr.srcdoc = doc;
    old.replaceWith(fr);
    $("btnRead").classList.toggle("on", readMode);
  }

  // On phones, opening an email hides the browser's address bar (Android Chrome).
  // Not needed when opened from the Home Screen icon (no address bar there).
  // iPhone Safari doesn't allow this; use Add to Home Screen instead.
  function autoHideBrowserBar() {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const phone = matchMedia("(max-width: 700px)").matches;
    if (!phone || standalone || document.fullscreenElement) return;
    try { document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {}); } catch {}
  }

  function setFull(on) {
    document.body.classList.toggle("full", on);
    try {
      if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch {}
  }
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) document.body.classList.remove("full"); });

  // ---------- Read aloud (sends the email to your Text Reader app) ----------
  // Both apps live on the same website, so they share browser storage.
  function emailToText() {
    const { html, text, subject } = cur;
    let body = text || "";
    if (html) {
      const d = document.createElement("div");
      d.innerHTML = cleanHtml(html).replace(/<img[^>]*>/gi, "");
      d.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,tr,br,table,blockquote").forEach((e) => e.append("\n"));
      body = d.textContent;
    }
    body = body.replace(/https?:\/\/\S+/g, "")      // don't read web addresses aloud
               .replace(/[ \t\u00a0]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
    return (subject ? subject + "\n" : "") + body;
  }
  $("btnSpeak").onclick = () => {
    try {
      localStorage.setItem("atsu.speak", JSON.stringify({ subject: cur.subject || "", text: emailToText(), ts: Date.now() }));
    } catch { status("Could not hand the email to Text Reader"); return; }
    window.open(CFG.VOICE_URL || "../text_reader/", "_blank");
  };

  $("btnRead").onclick = () => { readMode = !readMode; save("readMode", readMode); render(); };
  $("btnBigger").onclick = () => { fontPx = Math.min(30, fontPx + 1); save("fontPx", fontPx); render(); };
  $("btnSmaller").onclick = () => { fontPx = Math.max(11, fontPx - 1); save("fontPx", fontPx); render(); };
  $("btnFull").onclick = () => setFull(true);
  $("btnExitFull").onclick = () => setFull(false);

  function closeReader() {
    setFull(false);
    $("reader").hidden = true; curMsgId = null;
    document.body.classList.remove("reading");
    $("btnBack").hidden = true;
  }

  // ---------- Back: button, Esc, phone back swipe, edge swipe ----------
  // Opening an email adds a "page" to the browser history, so the phone's
  // normal back gesture/button closes the email instead of leaving the app.
  function goBack() {
    if ($("reader").hidden) return;
    // In full screen, the first swipe/back only leaves full screen.
    if (document.body.classList.contains("full")) { setFull(false); return; }
    if (history.state && history.state.atsuRead) history.back(); else closeReader();
  }
  window.addEventListener("popstate", () => { if (!$("reader").hidden) closeReader(); });

  // Swipe detector: calls fn("right"|"left") for a mostly-sideways swipe.
  function onSwipe(el, fn) {
    let x0 = null, y0 = 0;
    el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) fn(dx > 0 ? "right" : "left");
    }, { passive: true });
  }
  // Edge strips over the email (the email itself can't see swipes).
  // Main gesture: start at the RIGHT edge and swipe to the left = back to the list.
  onSwipe($("edgeR"), (d) => { if (d === "left") goBack(); });
  onSwipe($("edge"), (d) => { if (d === "right") goBack(); });
  onSwipe($("metabar"), () => goBack());
  // In the list: swipe right = show folders, swipe left = hide folders.
  onSwipe($("list"), (d) => document.body.classList.toggle("show-folders", d === "right"));
  onSwipe($("folders"), (d) => { if (d === "left") document.body.classList.remove("show-folders"); });

  async function loadAll() {
    try { await loadLabels(); await loadList(); } catch (e) { status(e.message); }
  }

  // ---------- Clicks ----------
  $("btnSignIn").onclick = () => tokenClient?.requestAccessToken();
  $("btnRefresh").onclick = () => loadAll();
  $("btnBack").onclick = () => goBack();
  $("btnFolders").onclick = () => document.body.classList.toggle("show-folders");
  $("btnMore").onclick = () => loadList(true).catch((e) => status(e.message));
  $("folders").onclick = (e) => {
    const f = e.target.closest(".folder"); if (!f) return;
    curLabel = f.dataset.id; $("path").textContent = "AtsuMail › " + f.dataset.name;
    document.querySelectorAll(".folder").forEach((x) => x.classList.toggle("sel", x === f));
    document.body.classList.remove("show-folders");
    goBack();
    loadList().catch((er) => status(er.message));
  };
  $("rows").onclick = (e) => { const r = e.target.closest(".row"); if (r) openMsg(r.dataset.id).catch((er) => status(er.message)); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") goBack(); });

  initAuth();
})();
