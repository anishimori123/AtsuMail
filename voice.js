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
        for (let i = x; i < y; i++) if (/[、,;；]/.test(para[i]) && i - k > 40) { pieces.push([k, i + 1]); k = i + 1; }
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
  }

  function show(text) { $("vNow").textContent = text; }
  function setBtn() { $("vPlay").innerHTML = playing ? "&#10074;&#10074;" : "&#9654;"; $("vPlay").title = playing ? "Pause" : "Play"; }

  function speakNext(g) {
    if (g !== gen || !playing) return;
    if (idx >= parts.length) { playing = false; setBtn(); show("Finished"); idx = 0; hooks.onClear && hooks.onClear(); return; }
    const p = parts[idx], st = STYLES[style] || STYLES.soft;
    const ja = isJa(p.t);
    const u = new SpeechSynthesisUtterance(p.t.replace(/https?:\/\/\S+/g, " "));
    const v = pick(ja ? "ja" : "en", ja ? voiceJa : voiceEn);
    if (v) u.voice = v;
    u.lang = v ? v.lang : (ja ? "ja-JP" : "en-US");
    u.rate = Math.min(3, st.rate * speed);
    u.pitch = st.pitch;
    const next = () => {
      if (g !== gen || !playing) return;
      idx++;
      $("vBar").style.width = Math.round((idx / parts.length) * 100) + "%";
      timer = setTimeout(() => speakNext(g), (p.para ? st.paraGap : st.gap) / speed);
    };
    u.onend = next;
    u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") next(); };
    say(idx);
    synth.speak(u);
  }

  function play() {
    if (!synth) { show("This browser has no voices."); return; }
    if (!parts.length) return;
    playing = true; gen++; setBtn();
    synth.cancel(); clearTimeout(timer);
    speakNext(gen);
  }
  // Pause = stop now and remember the sentence (more reliable than synth.pause on phones).
  function pause() { playing = false; gen++; clearTimeout(timer); synth && synth.cancel(); setBtn(); }
  function stop() { pause(); idx = 0; $("vBar").style.width = "0%"; hooks.onClear && hooks.onClear(); }

  // input: plain text, or a ready list of parts from the app. h: { onSay, onClear }
  function open(input, h) {
    stop();
    hooks = h || {};
    parts = typeof input === "string" ? split(input) : input;
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
  $("vStyle").onchange = (e) => { style = e.target.value; save("style", style); restartIfPlaying(); };
  $("vEn").onchange = (e) => { voiceEn = e.target.value; save("voiceEn", voiceEn); restartIfPlaying(); };
  $("vJa").onchange = (e) => { voiceJa = e.target.value; save("voiceJa", voiceJa); restartIfPlaying(); };
  $("vSlower").onclick = () => { speed = Math.max(0.5, Math.round((speed - 0.1) * 10) / 10); save("speed", speed); fillSelects(); restartIfPlaying(); };
  $("vFaster").onclick = () => { speed = Math.min(2.5, Math.round((speed + 0.1) * 10) / 10); save("speed", speed); fillSelects(); restartIfPlaying(); };
  if (synth) synth.onvoiceschanged = () => { if (!$("player").hidden) fillSelects(); };
  addEventListener("beforeunload", () => synth && synth.cancel());

  return { open, close, stop, replace, jump, split, isOpen: () => !$("player").hidden, parts: () => parts };
})();
