// AtsuMail voice reader - reads an email aloud using the voices built into your
// browser / phone (free, no account). English and Japanese, switching per sentence.
window.AtsuVoice = (() => {
  const $ = (id) => document.getElementById(id);
  const synth = window.speechSynthesis;
  const load = (k, d) => { try { const v = localStorage.getItem("atsu.v." + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem("atsu.v." + k, JSON.stringify(v)); } catch {} };

  // Reading styles. Browser voices can't truly change emotion, so a "style" is
  // speed + pitch + how long to pause between sentences and paragraphs.
  const STYLES = {
    soft: { label: "Soft",     rate: 0.92, pitch: 0.95, gap: 450, paraGap: 900 },
    dj:   { label: "Radio DJ", rate: 1.06, pitch: 1.04, gap: 120, paraGap: 450 },
    news: { label: "News",     rate: 1.00, pitch: 1.00, gap: 250, paraGap: 600 }
  };

  let parts = [], idx = 0, playing = false, gen = 0, timer = null;
  let curU = null, watchdog = null;   // keep the sentence being spoken (Chrome may lose it otherwise)
  const log = (k, m) => { try { window.AtsuLog && AtsuLog.add(k, m); } catch {} };
  let hooks = {};   // onSay(part, i) and onClear() - used by the app to highlight text
  const say = (i) => { if (parts[i]) { show(`${i + 1}/${parts.length}  ${parts[i].t}`); hooks.onSay && hooks.onSay(parts[i], i); } };
  let style = load("style", "soft"), speed = load("speed", 1.0);
  let voiceEn = load("voiceEn", ""), voiceJa = load("voiceJa", "");

  const isJa = (s) => /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(s);

  // Best-sounding voices first: Edge "Online (Natural)", Apple "Premium/Enhanced", Google.
  function rank(v) {
    let s = 0;
    if (/natural|neural/i.test(v.name)) s += 50;
    if (/online/i.test(v.name)) s += 20;
    if (/premium/i.test(v.name)) s += 40;
    if (/enhanced/i.test(v.name)) s += 30;
    if (/google/i.test(v.name)) s += 15;
    if (/siri/i.test(v.name)) s += 25;
    if (/compact|espeak/i.test(v.name)) s -= 30;
    return s;
  }
  const voices = (lang) => (synth ? synth.getVoices() : [])
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(lang))
    .sort((a, b) => rank(b) - rank(a) || (b.lang === "en-US") - (a.lang === "en-US"));
  const pick = (lang, name) => { const list = voices(lang); return list.find((v) => v.name === name) || list[0] || null; };

  // Split text into sentences, remembering where each one starts/ends in the text
  // (so the app can highlight it). Paragraph ends get a longer pause.
  function split(S) {
    const out = [];
    const re = /[^\n]+/g; let m;
    while ((m = re.exec(S))) {
      const ps = m.index, para = m[0], cuts = [];
      let a = 0;
      for (let i = 0; i < para.length; i++) {
        const c = para[i], n = para[i + 1];
        const endJa = /[。！？]/.test(c) && !/[。！？」』）)]/.test(n || "");
        const endEn = /[.!?]/.test(c) && (n === undefined || /\s/.test(n)) && !/[.!?]/.test(n || "");
        if (endJa || endEn || (c === "」" && /[。！？]/.test(para[i - 1] || ""))) { cuts.push([a, i + 1]); a = i + 1; }
      }
      if (a < para.length) cuts.push([a, para.length]);
      // very long sentences: cut after commas so the voice doesn't stop mid-way
      const pieces = [];
      cuts.forEach(([x, y]) => {
        if (y - x <= 220) return pieces.push([x, y]);
        let k = x;
        for (let i = x; i < y; i++) {
          if (/[、,;；]/.test(para[i]) && i - k > 40) { pieces.push([k, i + 1]); k = i + 1; }
          // no comma for a long time (common in Japanese newsletters): cut anyway,
          // at a space if there is one nearby, so the voice never gets a giant piece
          else if (i - k >= 180) {
            let cut = i;
            for (let j = i; j > i - 40; j--) if (/\s/.test(para[j])) { cut = j; break; }
            pieces.push([k, cut + 1]); k = cut + 1;
          }
        }
        if (k < y) pieces.push([k, y]);
      });
      const kept = pieces.map(([x, y]) => {
        while (x < y && /\s/.test(para[x])) x++;
        while (y > x && /\s/.test(para[y - 1])) y--;
        return { start: ps + x, end: ps + y, t: para.slice(x, y) };
      }).filter((p) => /[\p{L}\p{N}]/u.test(p.t.replace(/https?:\/\/\S+/g, "")));
      kept.forEach((p, i) => out.push({ ...p, para: i === kept.length - 1 }));
    }
    return out;
  }

  function fillSelects() {
    const opt = (list, cur) => list.map((v) => `<option value="${v.name.replace(/"/g, "&quot;")}" ${v.name === cur ? "selected" : ""}>${v.name.replace(/^Microsoft |^Google /, "").slice(0, 40)}</option>`).join("") || "<option>(none)</option>";
    const en = voices("en"), ja = voices("ja");
    $("vEn").innerHTML = opt(en, (pick("en", voiceEn) || {}).name);
    $("vJa").innerHTML = opt(ja, (pick("ja", voiceJa) || {}).name);
    $("vStyle").innerHTML = Object.entries(STYLES).map(([k, s]) => `<option value="${k}" ${k === style ? "selected" : ""}>${s.label}</option>`).join("");
    $("vSpeed").textContent = speed.toFixed(1) + "x";
    $("vEngine").value = engine;
  }

  function show(text) { $("vNow").textContent = text; }
  function setBtn() { $("vPlay").innerHTML = playing ? "&#10074;&#10074;" : "&#9654;"; $("vPlay").title = playing ? "Pause" : "Play"; }

  function speakNext(g) {
    if (g !== gen || !playing) return;
    if (idx >= parts.length) { keepAwake(false); playing = false; setBtn(); show("Finished"); idx = 0; curU = null; hooks.onClear && hooks.onClear(); log("voice", "finished reading"); { const f = hooks.onFinish; f && f(); } return; }
    const p = parts[idx], st = STYLES[style] || STYLES.soft;
    const ja = isJa(p.t);
    const u = new SpeechSynthesisUtterance(p.t.replace(/https?:\/\/\S+/g, " "));
    const v = pick(ja ? "ja" : "en", ja ? voiceJa : voiceEn);
    if (v) u.voice = v;
    u.lang = v ? v.lang : (ja ? "ja-JP" : "en-US");
    u.rate = Math.min(3, st.rate * speed);
    u.pitch = st.pitch;
    const next = () => {
      clearTimeout(watchdog);
      if (g !== gen || !playing) return;
      idx++;
      $("vBar").style.width = Math.round((idx / parts.length) * 100) + "%";
      timer = setTimeout(() => speakNext(g), (p.para ? st.paraGap : st.gap) / speed);
    };
    u.onend = next;
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      log("voice-error", `${e.error} at sentence ${idx + 1}/${parts.length} (${ja ? "JA" : "EN"}, ${p.t.length} chars, voice: ${v ? v.name : "default"})`);
      next();
    };
    const deviceSpeak = () => {
      curU = u;
      say(idx);
      try { window.AtsuLog && AtsuLog.state(`voice ${ja ? "JA" : "EN"} sentence ${idx + 1}/${parts.length}`); } catch {}
      try { synth.speak(u); } catch (err) { log("voice-error", "speak failed: " + err.message); next(); return; }
      // Safety timer: if the voice engine never says "finished", skip ahead instead of freezing.
      const limit = (p.t.length * (ja ? 330 : 120)) / Math.max(0.5, u.rate) + 8000;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (g !== gen || !playing || curU !== u) return;
        log("voice-stuck", `no "finished" after ${Math.round(limit / 1000)}s at sentence ${idx + 1}/${parts.length} (${ja ? "JA" : "EN"}, ${p.t.length} chars) - skipped`);
        synth.cancel(); next();
      }, limit);
    };
    // Natural voice (Kokoro) for Japanese sentences; English and anything it can't read use the device voice.
    if (engine === "natural" && ja) {
      say(idx);
      try { window.AtsuLog && AtsuLog.state(`voice JA (natural) sentence ${idx + 1}/${parts.length}`); } catch {}
      speakNatural(g, p, st, next, deviceSpeak);
    } else deviceSpeak();
  }

  // ---------- Natural Japanese voice (open-source yomiscript + Kokoro, runs in the browser) ----------
  let engine = load("engine", "device"), natModule = null, natUrl = null, natFails = 0, natCount = 0;
  const natCache = new Map();          // sentence text -> Promise of its audio
  const audio = new Audio();
  function natMod() {
    if (!natModule) {
      natModule = import("./lab/engine.js?v=2").then(async (m) => {
        const r = await m.init((t) => { if (playing) show(t); }, (t) => log("natural", t));
        log("voice", `natural voice ready (${r.mode === "gpu" ? "graphics chip" : "CPU, " + r.threads + " thread(s) - may be slow"})`);
        return m;
      });
      natModule.catch(() => { natModule = null; });
    }
    return natModule;
  }
  function natGet(text) {
    if (!natCache.has(text)) {
      const pr = natMod().then((m) => m.synth(text.replace(/https?:\/\/\S+/g, " "), "jf_alpha"));
      natCache.set(text, pr);
      pr.catch(() => natCache.delete(text));
      if (natCache.size > 30) natCache.delete(natCache.keys().next().value);
    }
    return natCache.get(text);
  }
  function speakNatural(g, p, st, next, fallback) {
    const job = natGet(p.t);
    for (let k = 1; k <= 4; k++) { const q = parts[idx + k]; if (q && isJa(q.t)) natGet(q.t).catch(() => {}); }   // make audio ahead
    job.then((res) => {
      if (g !== gen || !playing) return;
      if (!res) { fallback(); return; }
      natFails = 0;
      say(idx);
      if (natUrl) URL.revokeObjectURL(natUrl);
      natUrl = URL.createObjectURL(res.blob);
      audio.src = natUrl; audio.volume = 1; audio.muted = false;
      if (natCount < 4) log("natural", `playing sentence ${idx + 1}: ${res.seconds.toFixed(1)} s of audio`);
      audio.playbackRate = Math.max(0.5, Math.min(3, st.rate * speed));
      audio.onended = () => { if (natCount <= 4) log("natural", `sentence ended after ${audio.currentTime.toFixed(1)} s`); if (g === gen) next(); };
      audio.onerror = () => { if (g === gen && playing) { log("voice-error", "natural voice: audio could not play - device voice used"); fallback(); } };
      audio.play().catch((e) => { if (g === gen && playing) { log("voice-error", "natural voice: " + e.message + " - device voice used"); fallback(); } });
      if (++natCount % 15 === 0) natModule && natModule.then((m) => { const s = m.stats(); log("voice", `natural voice speed: ${s.speed.toFixed(2)} s of work per 1 s of audio (${s.mode})`); }).catch(() => {});
    }).catch((e) => {
      if (g !== gen || !playing) return;
      log("voice-error", "natural voice failed: " + (e && e.message || e) + " - device voice used");
      if (++natFails >= 3) { engine = "device"; $("vEngine").value = "device"; log("voice", "natural voice switched off after 3 failures"); }
      fallback();
    });
  }

  // Keep the phone screen on while reading aloud (a sleeping screen makes Android
  // pause or even close the browser tab). Released on pause/stop.
  let wake = null;
  async function keepAwake(on) {
    try {
      if (on && !wake && navigator.wakeLock) {
        wake = await navigator.wakeLock.request("screen");
        wake.addEventListener("release", () => { wake = null; });
      } else if (!on && wake) { await wake.release(); wake = null; }
    } catch (e) { log("info", "screen-on lock not available: " + e.message); }
  }
  // The lock is dropped when you switch apps; take it again when you come back.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && playing) keepAwake(true); });

  function play() {
    if (!synth) { show("This browser has no voices."); return; }
    if (!parts.length) return;
    keepAwake(true);
    playing = true; gen++; setBtn();
    synth.cancel(); clearTimeout(timer); try { audio.pause(); } catch {}
    speakNext(gen);
  }
  // Pause = stop now and remember the sentence (more reliable than synth.pause on phones).
  function pause() { keepAwake(false); playing = false; gen++; clearTimeout(timer); clearTimeout(watchdog); curU = null; synth && synth.cancel(); try { audio.pause(); } catch {} setBtn(); }
  function stop() { pause(); idx = 0; $("vBar").style.width = "0%"; hooks.onClear && hooks.onClear(); }

  // input: plain text, or a ready list of parts from the app. h: { onSay, onClear }
  function open(input, h) {
    stop();
    hooks = h || {};
    parts = typeof input === "string" ? split(input) : input;
    const jaN = parts.filter((p) => isJa(p.t)).length, longest = parts.reduce((m, p) => Math.max(m, p.t.length), 0);
    log("voice", `start: ${parts.length} sentences (${jaN} JA), longest ${longest} chars, style ${style}, speed ${speed}x, voices EN="${(pick("en", voiceEn) || {}).name || "none"}" JA="${(pick("ja", voiceJa) || {}).name || "none"}"`);
    $("player").hidden = false;
    fillSelects();
    play();
  }
  function close() { stop(); $("player").hidden = true; hooks = {}; }
  // The page was re-drawn (e.g. text size changed): swap in new parts, keep the place.
  function replace(newParts) {
    const curText = parts[idx] && parts[idx].t;
    parts = newParts;
    const same = curText ? parts.findIndex((p) => p.t === curText) : -1;
    idx = same >= 0 ? same : Math.min(idx, Math.max(0, parts.length - 1));
    if (!$("player").hidden) say(idx);
  }

  // ---- controls ----
  function restartIfPlaying() { if (playing) play(); }
  $("vPlay").onclick = () => (playing ? pause() : play());
  $("vStop").onclick = () => { stop(); show("Stopped"); };
  // Jump to a sentence (used when you tap text in the email)
  function jump(i) { idx = Math.max(0, Math.min(parts.length - 1, i)); playing ? play() : say(idx); }
  $("vPrev").onclick = () => { idx = Math.max(0, idx - 1); playing ? play() : say(idx); };
  $("vNext").onclick = () => { idx = Math.min(parts.length - 1, idx + 1); playing ? play() : say(idx); };
  $("vClose").onclick = close;
  $("vEngine").onchange = (e) => { engine = e.target.value; save("engine", engine); natFails = 0; log("voice", "Japanese voice: " + engine); restartIfPlaying(); };
  $("vStyle").onchange = (e) => { style = e.target.value; save("style", style); restartIfPlaying(); };
  $("vEn").onchange = (e) => { voiceEn = e.target.value; save("voiceEn", voiceEn); restartIfPlaying(); };
  $("vJa").onchange = (e) => { voiceJa = e.target.value; save("voiceJa", voiceJa); restartIfPlaying(); };
  $("vSlower").onclick = () => { speed = Math.max(0.5, Math.round((speed - 0.1) * 10) / 10); save("speed", speed); fillSelects(); restartIfPlaying(); };
  $("vFaster").onclick = () => { speed = Math.min(2.5, Math.round((speed + 0.1) * 10) / 10); save("speed", speed); fillSelects(); restartIfPlaying(); };
  if (synth) synth.onvoiceschanged = () => { if (!$("player").hidden) fillSelects(); };
  addEventListener("beforeunload", () => synth && synth.cancel());

  return { open, close, stop, replace, jump, split, isOpen: () => !$("player").hidden, parts: () => parts };
})();
