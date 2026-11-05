// AtsuMail - a tiny, read-only Gmail reader. Runs fully in your browser.
(() => {
  const CFG = window.ATSU_CONFIG || {};
  const DEMO = !CFG.CLIENT_ID;
  const API = "https://gmail.googleapis.com/gmail/v1/users/me";
  const $ = (id) => document.getElementById(id);

  let token = null, tokenClient = null, grantedScopes = "";
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
        grantedScopes = r.scope || "";
        $("btnSignIn").textContent = "Signed in";
        loadAll();
      }
    });
    status("Click Sign in to connect Gmail");
  }

  async function gapi(path, opts = {}) {
    if (!token) throw new Error("Not signed in");
    const headers = { Authorization: "Bearer " + token };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(path.startsWith("http") ? path : API + path, {
      method: opts.method || "GET", headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
    if (r.status === 401) { token = null; $("btnSignIn").textContent = "Sign in"; throw new Error("Session expired - click Sign in again"); }
    if (!r.ok) {
      // Show Google's own reason (e.g. "API not enabled", "insufficient permission", "no access to this file")
      let why = ""; try { why = (await r.json()).error.message || ""; } catch {}
      const who = path.includes("sheets.googleapis") ? "Sheets" : path.includes("/drive/") ? "Drive" : "Gmail";
      throw new Error(who + " error " + r.status + (why ? ": " + why.slice(0, 220) : ""));
    }
    return r.status === 204 ? {} : r.json();
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
      return `<div class="folder ${depth ? "sub" : ""} ${l.id === curLabel ? "sel" : ""}" style="${depth > 1 ? `padding-left:${10 + depth * 1.2}em` : ""}" data-id="${esc(l.id)}" data-name="${esc(l.type === "system" ? prettyName(l.name) : l.name)}">${esc(name)}${l.unread ? ` <span class="n">(${l.unread})</span>` : ""}</div>`;
    }).join("") + sheetFolders() + watchFolder();
  }

  // ---------- Google Sheets (read-only) ----------
  const SHEETS = (CFG.SHEETS || []).filter((s) => s && s.name);
  let curSheet = null, curTab = null;
  const sheetId = (url) => (String(url || "").match(/\/d\/([\w-]{20,})/) || [])[1] || "";
  function sheetFolders() {
    if (!SHEETS.length) return "";
    return `<div class="tree-head">Sheets</div>` + SHEETS.map((s, i) =>
      `<div class="folder sheet ${curSheet === i ? "sel" : ""}" data-sheet="${i}" data-name="${esc(s.name)}">${esc(s.name)}</div>`).join("");
  }
  async function openSheet(i) {
    curSheet = i; curTab = null;
    document.body.classList.add("sheetmode");
    $("sheetview").hidden = false;
    $("sheetgrid").innerHTML = ""; $("sheettabs").innerHTML = "";
    const s = SHEETS[i], id = sheetId(s.url);
    status("Loading sheet...");
    let tabs;
    if (DEMO) tabs = Object.keys(ATSU_DEMO.sheet); // demo mode always shows the fake sheet
    else if (token && grantedScopes && !grantedScopes.includes("spreadsheets")) {
      $("sheetgrid").innerHTML = `<p class="hint">You signed in without the <b>"See your Google Sheets"</b> permission.<br>Click <b>Sign in</b> again and make sure that box is <b>ticked</b> on Google's screen.</p>`;
      status("Sheets permission not given"); return;
    }
    else if (!id) { $("sheetgrid").innerHTML = `<p class="hint">Paste the link of "${esc(s.name)}" into <b>config.js</b> (SHEETS) to show it here.</p>`; status("No sheet link yet"); return; }
    else {
      const meta = await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties(title,hidden)`);
      tabs = meta.sheets.filter((t) => !t.properties.hidden).map((t) => t.properties.title);
    }
    $("sheettabs").innerHTML = tabs.map((t) => `<button data-tab="${esc(t)}">${esc(t)}</button>`).join("");
    await openTab(tabs[0]);
  }
  // Fetch one tab WITH its formatting (colors, bold, alignment, merged cells, column widths).
  async function loadGrid(id, tab) {
    const fields = "sheets(merges,data(columnMetadata(pixelSize),rowData(values(formattedValue,hyperlink," +
      "textFormatRuns(startIndex,format(link(uri)))," +
      "effectiveFormat(backgroundColor,horizontalAlignment,textFormat(foregroundColor,bold,italic,strikethrough,underline))))))";
    const range = encodeURIComponent("'" + tab.replace(/'/g, "''") + "'");
    const res = await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${id}?ranges=${range}&includeGridData=true&fields=${encodeURIComponent(fields)}`);
    const sh = (res.sheets || [])[0] || {}, d = (sh.data || [])[0] || {};
    return {
      rows: (d.rowData || []).map((r) => (r.values || []).map((c) => ({
        v: c.formattedValue ?? "", f: c.effectiveFormat || {},
        link: c.hyperlink || "",                                   // whole cell is a link (or =HYPERLINK)
        runs: (c.textFormatRuns || []).map((t) => ({ i: t.startIndex || 0, uri: t.format && t.format.link && t.format.link.uri || "" }))
      }))),
      widths: (d.columnMetadata || []).map((m) => m.pixelSize || 100),
      merges: sh.merges || []
    };
  }
  // Demo: turn the fake text table into the same shape, with a little color.
  function demoGrid(tab) {
    const rows = (ATSU_DEMO.sheet[tab] || []).map((r, ri) => r.map((v, ci) => ({ v, f: ri === 0
      ? { backgroundColor: { red: 0.79, green: 0.89, blue: 1 }, textFormat: { bold: true }, horizontalAlignment: "CENTER" }
      : (ci === 2 && parseFloat(String(v).replace(/,/g, "")) >= 5000 ? { textFormat: { foregroundColor: { red: 0.85, green: 0.1, blue: 0.1 }, bold: true } } : {}) })));
    if (rows[2] && rows[2][3]) rows[2][3].link = "https://www.google.com/search?q=candles"; // demo link
    return { rows, widths: [], merges: [] };
  }

  const rgb = (c) => `rgb(${Math.round((c.red || 0) * 255)},${Math.round((c.green || 0) * 255)},${Math.round((c.blue || 0) * 255)})`;
  const isWhite = (c) => !c || ((c.red ?? 0) > 0.98 && (c.green ?? 0) > 0.98 && (c.blue ?? 0) > 0.98);
  const lum = (c) => 0.299 * (c.red || 0) + 0.587 * (c.green || 0) + 0.114 * (c.blue || 0);

  // Style for one cell. White (= no color) cells stay dark like the app;
  // any color you set in the sheet is shown as-is.
  function cellStyle(f) {
    const st = [], tf = f.textFormat || {}, bg = f.backgroundColor, fg = tf.foregroundColor;
    if (!isWhite(bg)) {
      st.push("background:" + rgb(bg));
      st.push("color:" + (fg ? rgb(fg) : "#000"));
    } else if (fg && lum(fg) > 0.3) st.push("color:" + rgb(fg));      // colored text on dark: keep if readable
    else if (fg && (fg.red || fg.green || fg.blue) && lum(fg) <= 0.3) {  // dark colored text: brighten so it shows on dark
      st.push(`color:rgb(${[fg.red, fg.green, fg.blue].map((x) => Math.round(110 + (x || 0) * 145)).join(",")})`);
    }
    if (tf.bold) st.push("font-weight:bold");
    if (tf.italic) st.push("font-style:italic");
    const deco = [tf.underline && "underline", tf.strikethrough && "line-through"].filter(Boolean).join(" ");
    if (deco) st.push("text-decoration:" + deco);
    if (f.horizontalAlignment) st.push("text-align:" + f.horizontalAlignment.toLowerCase());
    return st.join(";");
  }

  // Turn a sheet link into a safe web address. "#gid=..." = link to another tab of the same sheet.
  function safeUrl(u, sheetUrl) {
    u = String(u || "").trim();
    if (u.startsWith("#")) return String(sheetUrl || "").replace(/[#?].*$/, "") + u;
    return /^(https?:|mailto:|tel:)/i.test(u) ? u : "";
  }
  const linkTag = (u, text) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(text)}</a>`;
  // Cell text, with links: the whole cell, or only some words (text runs)
  function cellHtml(cell, sheetUrl) {
    const v = String(cell.v ?? "");
    const whole = safeUrl(cell.link, sheetUrl);
    if (whole) return linkTag(whole, v || whole);
    const runs = (cell.runs || []).filter((r) => r.i < v.length);
    if (!runs.some((r) => r.uri)) return esc(v);
    let out = "";
    runs.forEach((r, k) => {
      const part = v.slice(r.i, k + 1 < runs.length ? runs[k + 1].i : v.length), u = safeUrl(r.uri, sheetUrl);
      out += u ? linkTag(u, part) : esc(part);
    });
    if (runs[0].i > 0) out = esc(v.slice(0, runs[0].i)) + out;
    return out;
  }

  async function openTab(tab) {
    curTab = tab;
    document.querySelectorAll("#sheettabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    const s = SHEETS[curSheet], id = sheetId(s.url);
    status("Loading " + tab + "...");
    const grid = DEMO ? demoGrid(tab) : await loadGrid(id, tab);

    // Cut off empty rows/columns at the end (Google sends the whole 1000-row sheet)
    const used = (c) => c && (c.v !== "" || !isWhite(c.f.backgroundColor));
    let nRows = 0, nCols = 0;
    grid.rows.forEach((r, ri) => r.forEach((c, ci) => { if (used(c)) { nRows = Math.max(nRows, ri + 1); nCols = Math.max(nCols, ci + 1); } }));
    nRows = Math.min(nRows, 3000); nCols = Math.max(1, nCols);

    // Merged cells: the top-left cell spans, the others are skipped
    const span = {}, hidden = new Set();
    grid.merges.forEach((m) => {
      const r0 = m.startRowIndex || 0, c0 = m.startColumnIndex || 0, r1 = m.endRowIndex, c1 = m.endColumnIndex;
      span[r0 + "," + c0] = [r1 - r0, c1 - c0];
      for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) if (r !== r0 || c !== c0) hidden.add(r + "," + c);
    });

    const colName = (n) => { let s = ""; n++; while (n) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
    const num = (v) => /^[-+]?[\d,]+(\.\d+)?%?$|^[$¥€£]/.test(String(v).trim());
    const widths = Array.from({ length: nCols }, (_, c) => Math.max(40, Math.min(420, grid.widths[c] || 100)));
    const fmt = grid.rows.some((r) => r.some((c) => Object.keys(c.f).length));
    let h = `<table class="${fmt ? "fmt" : ""}" style="width:${44 + widths.reduce((a, b) => a + b, 0)}px">` +
      `<colgroup><col style="width:44px">${widths.map((w) => `<col style="width:${w}px">`).join("")}</colgroup>` +
      `<thead><tr><th class="rn"></th>${widths.map((_, c) => `<th>${colName(c)}</th>`).join("")}</tr></thead><tbody>`;
    for (let ri = 0; ri < nRows; ri++) {
      const r = grid.rows[ri] || [];
      h += `<tr><th class="rn">${ri + 1}</th>`;
      for (let c = 0; c < nCols; c++) {
        if (hidden.has(ri + "," + c)) continue;
        const cell = r[c] || { v: "", f: {} }, sp = span[ri + "," + c];
        const attrs = sp ? `${sp[0] > 1 ? ` rowspan="${sp[0]}"` : ""}${sp[1] > 1 ? ` colspan="${sp[1]}"` : ""}` : "";
        h += `<td${attrs} class="${num(cell.v) ? "num" : ""}" style="${cellStyle(cell.f)}" title="${esc(cell.v)}">${cellHtml(cell, s.url)}</td>`;
      }
      h += "</tr>";
    }
    $("sheetgrid").innerHTML = h + "</tbody></table>";
    $("sheetgrid").scrollTo(0, 0);
    status(`${s.name} › ${tab} · ${nRows} rows`);
  }
  function closeSheet() {
    if (document.body.classList.contains("sheetmode")) setFull(false);
    curSheet = null;
    document.body.classList.remove("sheetmode");
    $("sheetview").hidden = true;
  }
  $("btnSheetFull").onclick = () => setFull(!document.body.classList.contains("full"));
  $("sheettabs").onclick = (e) => { const b = e.target.closest("button"); if (b) openTab(b.dataset.tab).catch((er) => status(er.message)); };
  // Phone: tap a cell to see its full text
  $("sheetgrid").onclick = (e) => { if (e.target.closest("a")) return; const td = e.target.closest("td"); if (td && td.scrollWidth > td.clientWidth) toast(td.title); };

  // ---------- Watch Later (YouTube + other links) ----------
  // Saved in a Google Sheet "AtsuMail Watch Later" in your Drive, so phone and PC share it.
  // Permission "drive.file" = AtsuMail can only see files it created itself.
  // Demo mode: saved on this device only.
  const WL_NAME = "AtsuMail Watch Later", WL_TAB = "Watch Later";
  let wlId = null, wl = [], wlLoaded = false;
  const ytId = (u) => {
    const m = String(u).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/))([\w-]{11})/i);
    return m ? m[1] : "";
  };
  const ytStart = (u) => { const m = String(u).match(/[?&#]t=(\d+h)?(\d+m)?(\d+)s?/); if (!m) return 0; return (parseInt(m[1]) || 0) * 3600 + (parseInt(m[2]) || 0) * 60 + (parseInt(m[3]) || 0); };
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  function watchFolder() {
    return `<div class="tree-head">Watch later</div><div class="folder watch" data-watch="1" data-name="Watch later">Watch later${wlLoaded ? ` <span class="n">(${wl.length})</span>` : ""}</div>`;
  }
  function wlCount() { const f = document.querySelector(".folder.watch"); if (f) f.innerHTML = `Watch later <span class="n">(${wl.length})</span>`; }

  // --- storage ---
  async function wlFind() {
    if (wlId) return wlId;
    const q = encodeURIComponent(`name='${WL_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    const res = await gapi(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&orderBy=createdTime`);
    if (res.files && res.files.length) return (wlId = res.files[0].id);
    const made = await gapi("https://sheets.googleapis.com/v4/spreadsheets", { method: "POST", body: { properties: { title: WL_NAME }, sheets: [{ properties: { title: WL_TAB } }] } });
    wlId = made.spreadsheetId;
    await wlWrite([]);
    return wlId;
  }
  async function wlRead() {
    if (DEMO) { try { wl = JSON.parse(localStorage.getItem("atsu.wl") || "null") || ATSU_DEMO.watch.slice(); } catch { wl = ATSU_DEMO.watch.slice(); } return; }
    const id = await wlFind();
    const res = await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("'" + WL_TAB + "'!A2:D")}`);
    wl = (res.values || []).filter((r) => r[2]).map((r) => ({ added: r[0] || "", title: r[1] || r[2], url: r[2], kind: r[3] || (ytId(r[2]) ? "youtube" : "link") }));
  }
  async function wlWrite(list) {
    if (DEMO) { try { localStorage.setItem("atsu.wl", JSON.stringify(list)); } catch {} return; }
    const range = encodeURIComponent("'" + WL_TAB + "'!A1:D");
    await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${wlId}/values/${range}:clear`, { method: "POST", body: {} });
    const values = [["Added", "Title", "Link", "Type"], ...list.map((x) => [x.added, x.title, x.url, x.kind])];
    await gapi(`https://sheets.googleapis.com/v4/spreadsheets/${wlId}/values/${encodeURIComponent("'" + WL_TAB + "'!A1")}?valueInputOption=RAW`, { method: "PUT", body: { values } });
  }
  async function wlTitle(url) {
    if (ytId(url)) {   // YouTube's public title lookup (no account needed)
      try { const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url)); if (r.ok) return (await r.json()).title; } catch {}
      try { const r = await fetch("https://noembed.com/embed?url=" + encodeURIComponent(url)); if (r.ok) { const j = await r.json(); if (j.title) return j.title; } } catch {}
      return "YouTube video";
    }
    return hostOf(url) || url;
  }

  // --- screens ---
  function renderWatch() {
    const html = wl.map((x, i) => {
      const id = ytId(x.url);
      const thumb = id ? `<img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy">` : `<div class="wl-ico">&#8599;</div>`;
      return `<div class="wl-row" data-i="${i}">${thumb}<div class="wl-txt"><div class="wl-title">${esc(x.title)}</div>` +
        `<div class="wl-sub">${id ? "YouTube" : esc(hostOf(x.url))} &middot; ${esc(x.added)}</div></div>` +
        `<button class="wl-del" data-del="${i}" title="Remove">&#x2715;</button></div>`;
    }).join("");
    $("wlist").innerHTML = html || `<p class="hint">Nothing saved yet. Paste a YouTube (or any) link above and press <b>Add</b>.</p>`;
    wlCount();
  }
  async function openWatch() {
    document.body.classList.add("watchmode");
    $("watchview").hidden = false; closePlayer();
    status("Loading Watch later...");
    if (!DEMO && token && grantedScopes && !grantedScopes.includes("drive.file")) {
      $("wlist").innerHTML = `<p class="hint">Watch later needs one more Google permission.<br>Click <b>Sign in</b> again and <b>tick</b> the box about Google Drive files used with this app.</p>`;
      status("Drive permission not given"); return;
    }
    await wlRead(); wlLoaded = true; renderWatch();
    status(`Watch later · ${wl.length} saved`);
  }
  function closeWatch() {
    if (document.body.classList.contains("watchmode")) setFull(false);
    document.body.classList.remove("watchmode");
    $("watchview").hidden = true; closePlayer();
  }
  function playItem(x) {
    const id = ytId(x.url);
    if (!id) { window.open(x.url, "_blank", "noopener"); return; }
    const start = ytStart(x.url);
    $("wframe").src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1${start ? "&start=" + start : ""}`;
    $("wopen").href = x.url; $("wtitle").textContent = x.title;
    $("wplayer").hidden = false; $("wmain").hidden = true;
  }
  function closePlayer() {
    if ($("wplayer").hidden) return;
    $("wframe").src = "about:blank";   // stops the video
    $("wplayer").hidden = true; $("wmain").hidden = false;
  }
  async function addLink() {
    let url = $("wurl").value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (!hostOf(url)) { toast("That doesn't look like a link"); return; }
    $("wadd").disabled = true; status("Adding...");
    try {
      const title = $("wname").value.trim() || await wlTitle(url);
      const d = new Date(), added = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!DEMO) await wlRead();            // get the newest list first (maybe changed on the other device)
      wl.unshift({ added, title, url, kind: ytId(url) ? "youtube" : "link" });
      await wlWrite(wl);
      $("wurl").value = ""; $("wname").value = "";
      renderWatch(); toast("Added: " + title.slice(0, 40)); status(`Watch later · ${wl.length} saved`);
    } catch (e) { status(e.message); }
    $("wadd").disabled = false;
  }
  async function removeAt(i) {
    const x = wl[i]; if (!x) return;
    if (!confirm(`Remove "${x.title}" from Watch later?`)) return;
    try {
      if (!DEMO) { await wlRead(); i = wl.findIndex((y) => y.url === x.url && y.added === x.added); if (i < 0) { renderWatch(); return; } }
      wl.splice(i, 1); await wlWrite(wl); renderWatch(); status(`Watch later · ${wl.length} saved`);
    } catch (e) { status(e.message); }
  }
  $("wadd").onclick = () => addLink();
  $("wurl").addEventListener("keydown", (e) => { if (e.key === "Enter") addLink(); });
  $("wname").addEventListener("keydown", (e) => { if (e.key === "Enter") addLink(); });
  $("wlist").onclick = (e) => {
    const del = e.target.closest("[data-del]"); if (del) { removeAt(+del.dataset.del); return; }
    const row = e.target.closest(".wl-row"); if (row) playItem(wl[+row.dataset.i]);
  };
  $("wback").onclick = () => closePlayer();
  $("wfull").onclick = () => setFull(!document.body.classList.contains("full"));

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
    AtsuVoice.close(); $("btnSpeak").classList.remove("on");
    render();
    if (!(history.state && history.state.atsuRead)) history.pushState({ atsuRead: 1 }, "");
    $("reader").hidden = false;
    autoHideBrowserBar();
    if (document.activeElement && document.activeElement.tagName === "IFRAME") document.activeElement.blur();
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
    // ::highlight / ::selection = the light-blue mark on the sentence being read aloud
    const base = `<base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>::highlight(atsu){background:#bfe3ff;color:#000} .atsu-sel ::selection{background:#bfe3ff;color:#000}</style>`;
    const dark = `<style>
      html{background:#1e1e1e;color:#ddd}
      body{margin:0 auto;padding:10px 12px 60px;font:${fontPx}px/1.6 Georgia,"Times New Roman",serif;word-wrap:break-word;overflow-wrap:anywhere}
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
    fr.addEventListener("load", onFrameLoad);
    old.replaceWith(fr);
    $("btnRead").classList.toggle("on", readMode);
  }

  // On phones, opening an email hides the browser's address bar (Android Chrome).
  // Not needed when opened from the Home Screen icon (no address bar there).
  // iPhone Safari doesn't allow this; use Add to Home Screen instead.
  function autoHideBrowserBar() {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const phone = matchMedia("(max-width: 700px), (max-height: 500px)").matches;
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
  // ---------- Read-aloud highlight ----------
  // The email frame is "same origin" (but its own scripts still can't run), so the
  // app can read its text and mark the sentence being spoken in light blue.
  let segs = [];   // where each piece of text sits: { node, s (start in full text), len }
  function buildSpeechParts() {
    const fr = $("body"), doc = fr.contentDocument;
    if (!doc || !doc.body) return AtsuVoice.split(emailToText());
    const BLOCK = /^(P|DIV|H[1-6]|LI|TR|TD|TH|TABLE|BLOCKQUOTE|SECTION|ARTICLE|PRE|UL|OL|CENTER|HR|DT|DD|HEADER|FOOTER)$/;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeType === 1 && /^(STYLE|SCRIPT|NOSCRIPT|TITLE|HEAD)$/.test(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let S = ""; segs = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 1) { if (n.tagName === "BR" || BLOCK.test(n.tagName)) S += "\n"; continue; }
      const keepLines = n.parentElement && n.parentElement.closest("pre,.plain");
      const t = keepLines ? n.data : n.data.replace(/\s/g, " ");   // same length, so positions stay correct
      if (!t) continue;
      segs.push({ node: n, s: S.length, len: t.length });
      S += t;
    }
    const where = (pos) => { for (const g of segs) if (pos >= g.s && pos < g.s + g.len) return [g.node, pos - g.s]; return null; };
    const parts = AtsuVoice.split(S).map((p) => {
      const a = where(p.start), b = where(p.end - 1);
      if (a && b) { const r = doc.createRange(); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1] + 1); p.range = r; }
      return p;
    });
    if (cur.subject && !S.slice(0, 300).includes(cur.subject)) parts.unshift({ t: cur.subject, para: true });
    return parts;
  }
  function highlight(p) {
    const fr = $("body"), win = fr.contentWindow, doc = fr.contentDocument;
    if (!win || !doc) return;
    clearHighlight();
    if (!p.range) return;
    if (win.CSS && win.CSS.highlights && win.Highlight) win.CSS.highlights.set("atsu", new win.Highlight(p.range));
    else { doc.documentElement.classList.add("atsu-sel"); const s = win.getSelection(); s.removeAllRanges(); s.addRange(p.range); }
    const r = p.range.getBoundingClientRect();
    if (r.top < 30 || r.bottom > win.innerHeight - 30) win.scrollBy({ top: r.top - win.innerHeight * 0.3, behavior: "smooth" });
  }
  function clearHighlight() {
    const win = $("body").contentWindow;
    if (!win) return;
    try { win.CSS && win.CSS.highlights && win.CSS.highlights.delete("atsu"); win.getSelection().removeAllRanges(); } catch {}
  }
  // Phone sideways: the email fills the whole width (even next to the camera),
  // but the TEXT is pushed away from the camera side so nothing hides behind it.
  function safeInsets() {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;visibility:hidden;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)";
    document.body.append(d);
    const cs = getComputedStyle(d), r = [parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0];
    d.remove(); return r;
  }
  function applyInsets() {
    const doc = $("body").contentDocument;
    if (!doc || !doc.body) return;
    // Phones report the whole camera side as "unsafe", but the camera is only a small
    // dot (e.g. Pixel), so only keep a thin extra margin there (max 10px).
    const [L, R] = safeInsets(), pad = (!cur.html || readMode) ? 12 : 0;
    doc.body.style.paddingLeft = (pad + Math.min(L, 10)) + "px";
    doc.body.style.paddingRight = (pad + Math.min(R, 10)) + "px";
  }
  addEventListener("resize", () => { if (!$("reader").hidden) setTimeout(applyInsets, 150); });

  function onFrameLoad() {
    const doc = $("body").contentDocument;
    if (!doc) return;
    applyInsets();
    // Esc and F keep working even after clicking inside the email
    doc.addEventListener("keydown", (e) => { if (e.key === "Escape" || e.key.toLowerCase() === "f") onKey(e); });
    // While the player is open: tap/click a sentence to read from there
    doc.addEventListener("click", (e) => {
      if (!AtsuVoice.isOpen() || e.target.closest("a")) return;
      const c = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(e.clientX, e.clientY)
              : doc.caretPositionFromPoint ? (() => { const p = doc.caretPositionFromPoint(e.clientX, e.clientY); const r = doc.createRange(); r.setStart(p.offsetNode, p.offset); return r; })() : null;
      if (!c) return;
      const g = segs.find((x) => x.node === c.startContainer);
      if (!g) return;
      const pos = g.s + c.startOffset;
      const i = AtsuVoice.parts().findIndex((p) => p.range && pos >= p.start && pos <= p.end);
      if (i >= 0) AtsuVoice.jump(i);
    });
    // Page was re-drawn while reading (e.g. text size): keep the place
    if (AtsuVoice.isOpen()) AtsuVoice.replace(buildSpeechParts());
  }

  // 🔊 = built-in voice player. ↗ in the player = open in your Text Reader app instead.
  $("btnSpeak").onclick = () => {
    if (AtsuVoice.isOpen()) { AtsuVoice.close(); $("btnSpeak").classList.remove("on"); return; }
    AtsuVoice.open(buildSpeechParts(), { onSay: highlight, onClear: clearHighlight }); $("btnSpeak").classList.add("on");
  };
  $("vClose").addEventListener("click", () => $("btnSpeak").classList.remove("on"));
  $("vTR").onclick = () => {
    AtsuVoice.stop();
    try {
      localStorage.setItem("atsu.speak", JSON.stringify({ subject: cur.subject || "", text: emailToText(), ts: Date.now() }));
    } catch { status("Could not hand the email to Text Reader"); return; }
    window.open(CFG.VOICE_URL || "../text_reader/", "_blank");
  };

  $("btnRead").onclick = () => { readMode = !readMode; save("readMode", readMode); render(); };
  // Text sizes: each tap jumps one step (about 10-15% bigger/smaller)
  const SIZES = [12, 14, 15, 17, 19, 21, 24, 27, 30, 34, 38];
  function stepFont(dir) {
    let i = SIZES.findIndex((s) => s >= fontPx); if (i < 0) i = SIZES.length - 1;
    if (SIZES[i] !== fontPx && dir < 0) i++; // between steps: snap the right way
    fontPx = SIZES[Math.max(0, Math.min(SIZES.length - 1, i + dir))];
    save("fontPx", fontPx); render();
    toast("Text size " + (SIZES.indexOf(fontPx) + 1) + " / " + SIZES.length);
  }
  let toastT;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 1200);
  }
  $("btnBigger").onclick = () => stepFont(+1);
  $("btnSmaller").onclick = () => stepFont(-1);
  $("btnFull").onclick = () => setFull(true);
  $("btnExitFull").onclick = () => setFull(false);

  function closeReader() {
    setFull(false);
    AtsuVoice.close(); $("btnSpeak").classList.remove("on");
    $("reader").hidden = true; curMsgId = null;
    document.body.classList.remove("reading");
    $("btnBack").hidden = true;
  }

  // ---------- Back: button, Esc, phone back swipe, edge swipe ----------
  // Opening an email adds a "page" to the browser history, so the phone's
  // normal back gesture/button closes the email instead of leaving the app.
  function goBack() {
    // In full screen (email or sheet), the first swipe/back only leaves full screen.
    if (document.body.classList.contains("full")) { setFull(false); return; }
    if (!$("wplayer").hidden) { closePlayer(); return; }
    if ($("reader").hidden) return;
    if (history.state && history.state.atsuRead) history.back(); else closeReader();
  }
  // Phone: on the email list, the phone's back gesture opens/closes the folder screen
  // instead of leaving AtsuMail. (We keep one extra "page" in history to catch it.)
  const isPhone = () => matchMedia("(max-width: 700px), (max-height: 500px)").matches;
  const armBack = () => { if (!(history.state && history.state.atsuList)) history.pushState({ atsuList: 1 }, ""); };
  if (isPhone()) { history.replaceState({ atsuBase: 1 }, ""); armBack(); }
  window.addEventListener("popstate", () => {
    if (!$("reader").hidden) { closeReader(); return; }
    if (document.body.classList.contains("full")) { setFull(false); armBack(); return; }
    if (!isPhone()) return;
    if (history.state && history.state.atsuBase) {
      document.body.classList.toggle("show-folders");
      armBack();
    }
  });

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
  $("btnRefresh").onclick = () => (document.body.classList.contains("watchmode") ? openWatch().catch((er) => status(er.message))
    : curSheet !== null ? openSheet(curSheet).catch((er) => status(er.message)) : loadAll());
  $("btnBack").onclick = () => goBack();
  $("btnBack2").onclick = () => goBack();
  $("btnFolders").onclick = () => document.body.classList.toggle("show-folders");
  $("btnMore").onclick = () => loadList(true).catch((e) => status(e.message));
  $("folders").onclick = (e) => {
    const f = e.target.closest(".folder"); if (!f) return;
    $("path").textContent = "AtsuMail › " + f.dataset.name;
    document.querySelectorAll(".folder").forEach((x) => x.classList.toggle("sel", x === f));
    document.body.classList.remove("show-folders");
    goBack();
    if (f.dataset.watch !== undefined) { closeSheet(); openWatch().catch((er) => status(er.message)); return; }
    closeWatch();
    if (f.dataset.sheet !== undefined) { openSheet(+f.dataset.sheet).catch((er) => status(er.message)); return; }
    closeSheet();
    curLabel = f.dataset.id;
    loadList().catch((er) => status(er.message));
  };
  $("rows").onclick = (e) => { const r = e.target.closest(".row"); if (r) openMsg(r.dataset.id).catch((er) => status(er.message)); };
  // PC keyboard: Esc = back, Up/Down = previous/next email
  function onKey(e) {
    if (e.key === "Escape") return goBack();
    // F: full screen on/off while an email is open (Ctrl+F stays the browser's Find)
    const plainF = e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (plainF && (!$("reader").hidden || /sheetmode|watchmode/.test(document.body.className))) {
      e.preventDefault();
      setFull(!document.body.classList.contains("full"));
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...document.querySelectorAll("#rows .row")];
    if (!rows.length) return;
    const i = rows.findIndex((r) => r.classList.contains("sel"));
    const next = rows[e.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)];
    if (next && next !== rows[i]) { e.preventDefault(); next.scrollIntoView({ block: "nearest" }); openMsg(next.dataset.id).catch((er) => status(er.message)); }
  }
  document.addEventListener("keydown", onKey);

  // ---------- PC: drag the dividers to resize (remembered) ----------
  function makeSplit(handle, cssVar, key, getEl, min, maxShare) {
    const apply = (px) => px ? document.body.style.setProperty(cssVar, px + "px") : document.body.style.removeProperty(cssVar);
    apply(load(key, null));
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const x0 = e.clientX, w0 = getEl().getBoundingClientRect().width;
      document.body.classList.add("dragging");
      let w = w0;
      const move = (ev) => {
        const max = $("main").getBoundingClientRect().width * maxShare;
        w = Math.round(Math.max(min, Math.min(max, w0 + ev.clientX - x0)));
        apply(w);
      };
      const up = () => {
        document.body.classList.remove("dragging");
        removeEventListener("mousemove", move); removeEventListener("mouseup", up);
        save(key, w);
      };
      addEventListener("mousemove", move); addEventListener("mouseup", up);
    });
    handle.addEventListener("dblclick", () => { apply(null); save(key, null); }); // reset
  }
  makeSplit($("split1"), "--foldW", "foldW", () => $("folders"), 120, 0.4);
  makeSplit($("split2"), "--listW", "listW", () => $("list"), 200, 0.75);

  initAuth();
})();
