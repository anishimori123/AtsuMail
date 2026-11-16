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

  // Split a Japanese sentence into Japanese pieces and English pieces. A run of Latin text counts as
  // English when it has a word of 3+ letters ("OpenAI", "machine learning"); short ones like "AI", "PC"
  // stay with the Japanese voice, which says them the way Japanese speakers do.
  function splitLang(text) {
    const out = [], re = /[A-Za-z][A-Za-z0-9'’.&+\-]*(?:[ ,]+[A-Za-z0-9][A-Za-z0-9'’.&+\-]*)*/g;
    let at = 0, m;
    const push = (t, ja) => { if (!/[\p{L}\p{N}]/u.test(t)) { if (out.length) out[out.length - 1].t += t; return; } const last = out[out.length - 1]; if (last && last.ja === ja) last.t += t; else out.push({ t, ja }); };
    while ((m = re.exec(text))) {
      if (!/[A-Za-z]{3,}/.test(m[0])) continue;
      if (m.index > at) push(text.slice(at, m.index), true);
      push(m[0].replace(/[.,]+$/, ""), false);
      at = m.index + m[0].length;
    }
    if (at < text.length) push(text.slice(at), true);
    return out.length ? out : [{ t: text, ja: true }];
  }
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
    $("vUse").textContent = engine === "azure" ? azUseText() : "";
  }

  function show(text) { $("vNow").textContent = text; }
  function setBtn() { $("vPlay").innerHTML = playing ? "&#10074;&#10074;" : "&#9654;"; $("vPlay").title = playing ? "Pause" : "Play"; }

  function speakNext(g) {
    if (g !== gen || !playing) return;
    if (idx >= parts.length) { keepAwake(false); playing = false; setBtn(); show("Finished"); idx = 0; curU = null; hooks.onClear && hooks.onClear(); log("voice", "finished reading"); { const f = hooks.onFinish; f && f(); } return; }
    const p = parts[idx], st = STYLES[style] || STYLES.soft;
    const ja = isJa(p.t);
    let step = 1;                      // how many sentences this turn covers (Azure reads several per request)
    const next = () => {
      clearTimeout(watchdog);
      if (g !== gen || !playing) return;
      const lastPart = parts[idx + step - 1] || p;
      idx += step;
      $("vBar").style.width = Math.round((idx / parts.length) * 100) + "%";
      timer = setTimeout(() => speakNext(g), (lastPart.para ? st.paraGap : st.gap) / speed);
    };
    // Device voice. A Japanese sentence with English words in it is spoken in pieces:
    // Japanese pieces with the Japanese voice, English words with the English voice
    // (otherwise the Japanese voice spells English out letter by letter).
    const deviceSpeak = () => {
      const text = p.t.replace(/https?:\/\/\S+/g, " ");
      const segs = ja ? splitLang(text) : [{ t: text, ja: false }];
      let k = 0;
      say(idx);
      try { window.AtsuLog && AtsuLog.state(`voice ${ja ? "JA" : "EN"} sentence ${idx + 1}/${parts.length}`); } catch {}
      const speakSeg = () => {
        if (g !== gen || !playing) return;
        if (k >= segs.length) { next(); return; }
        const sg = segs[k], uu = new SpeechSynthesisUtterance(sg.t);
        const vv = pick(sg.ja ? "ja" : "en", sg.ja ? voiceJa : voiceEn);
        if (vv) uu.voice = vv;
        uu.lang = vv ? vv.lang : (sg.ja ? "ja-JP" : "en-US");
        uu.rate = Math.min(3, st.rate * speed);
        uu.pitch = st.pitch;
        const after = () => { if (curU !== uu) return; clearTimeout(watchdog); k++; speakSeg(); };
        uu.onend = after;
        uu.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          log("voice-error", `${e.error} at sentence ${idx + 1}/${parts.length} (${sg.ja ? "JA" : "EN"}, ${sg.t.length} chars, voice: ${vv ? vv.name : "default"})`);
          after();
        };
        curU = uu;
        try { synth.speak(uu); } catch (err) { log("voice-error", "speak failed: " + err.message); after(); return; }
        // Safety timer: if the voice engine never says "finished", skip ahead instead of freezing.
        const limit = (sg.t.length * (sg.ja ? 330 : 120)) / Math.max(0.5, uu.rate) + 8000;
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          if (g !== gen || !playing || curU !== uu) return;
          log("voice-stuck", `no "finished" after ${Math.round(limit / 1000)}s at sentence ${idx + 1}/${parts.length} (${sg.ja ? "JA" : "EN"}, ${sg.t.length} chars) - skipped`);
          synth.cancel(); after();
        }, limit);
      };
      speakSeg();
    };
    // Natural voice (Kokoro) for Japanese sentences; English and anything it can't read use the device voice.
    if (engine === "azure" && azReady()) {
      say(idx);
      try { window.AtsuLog && AtsuLog.state(`voice ${ja ? "JA" : "EN"} (Azure) sentence ${idx + 1}/${parts.length}`); } catch {}
      const grp = azGroup(idx);
      step = grp.n;
      if (grp.n > 1 && hooks.onSay) {                       // highlight the whole group being read
        const a = parts[idx].range, b = parts[idx + grp.n - 1].range;
        if (a && b) { try { const r = a.cloneRange(); r.setEnd(b.endContainer, b.endOffset); hooks.onSay({ range: r }, idx); } catch {} }
      }
      speakAzure(g, grp, st, next, () => { step = 1; deviceSpeak(); });
    } else if (engine === "natural" && ja) {
      say(idx);
      try { window.AtsuLog && AtsuLog.state(`voice JA (natural) sentence ${idx + 1}/${parts.length}`); } catch {}
      speakNatural(g, p, st, next, deviceSpeak);
    } else deviceSpeak();
  }

  // ---------- Azure cloud voice (Microsoft Azure Speech; the text of each sentence is sent to Azure) ----------
  // Free plan: 500,000 characters a month, where each Japanese/Chinese/Korean character counts as 2.
  // AtsuMail keeps its own count for the month and stops using Azure at the limit set here.
  const AZ = {
    get key() { return load("azKey", ""); }, get region() { return load("azRegion", "japaneast"); },
    get voiceJa() { return load("azVoiceJa", "ja-JP-NanamiNeural"); }, get voiceEn() { return load("azVoiceEn", "en-US-AvaNeural"); },
    get cap() { return load("azCap", 450000); },
  };
  const azMonth = () => new Date().toISOString().slice(0, 7);
  function azUsed() { const u = load("azUse", null); return u && u.month === azMonth() ? u.chars : 0; }
  function azAdd(n) { save("azUse", { month: azMonth(), chars: azUsed() + n }); }
  // How Azure counts: every character, CJK characters twice.
  const azCost = (t) => { let n = 0; for (const ch of t) n += /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/.test(ch) ? 2 : 1; return n; };
  const azReady = () => !!AZ.key && !azBlocked;
  let azBlocked = false, azFails = 0;
  const azCache = new Map();
  const xml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  function azNote(t) { $("vNote").textContent = t; $("vNote").hidden = false; }
  function azStopUsing(why) {
    azBlocked = true; azCache.clear();
    log("voice", "Azure voice off: " + why);
    azNote(why + " Using the Device voice.");
  }
  // Azure's free plan allows about 20 requests a minute, so AtsuMail sends several sentences in one
  // request (about 80+ characters each time) and never more than 14 requests in any 60 seconds.
  function azGroup(i) {
    const ja = isJa(parts[i].t);
    let text = parts[i].t, n = 1;
    while (parts[i + n] && isJa(parts[i + n].t) === ja && text.length < 80 && text.length + parts[i + n].t.length <= 300) {
      text += (ja ? "" : " ") + parts[i + n].t; n++;
    }
    return { text, n, ja };
  }
  const azTimes = [];
  async function azSlot() {
    for (;;) {
      const now = Date.now();
      while (azTimes.length && now - azTimes[0] > 60000) azTimes.shift();
      if (azTimes.length < 14) { azTimes.push(now); return; }
      await new Promise((r) => setTimeout(r, 60000 - (now - azTimes[0]) + 200));
    }
  }
  async function azFetch(clean, ja, tries = 3) {
    const voice = ja ? AZ.voiceJa : AZ.voiceEn, lang = voice.slice(0, 5);
    for (let k = 1; ; k++) {
      await azSlot();
      try {
        const r = await fetch(`https://${AZ.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": AZ.key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3" },
          body: `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">${xml(clean)}</voice></speak>`,
        });
        if (r.status === 401 || r.status === 403 || r.status === 400) throw Object.assign(new Error("Azure answered " + r.status), { status: r.status, final: true });
        if (!r.ok) throw Object.assign(new Error("Azure answered " + r.status), { status: r.status });
        const blob = await r.blob();
        if (!blob.size) throw new Error("Azure sent no audio");
        return blob;
      } catch (e) {
        if (e.final || k >= tries) throw e;
        // "busy" answers (429) often arrive as a plain network error in the browser: wait and try again
        log("voice", `Azure busy or unreachable (${e.message}) - waiting ${k * 8} s, try ${k + 1}/${tries}`);
        await new Promise((r) => setTimeout(r, k * 8000));
      }
    }
  }
  function azGet(text, ja) {
    const key = (ja ? "j:" : "e:") + text;
    if (azCache.has(key)) return azCache.get(key);
    const clean = text.replace(/https?:\/\/\S+/g, " ").trim(), cost = azCost(clean);
    if (azUsed() + cost > AZ.cap) return Promise.reject(Object.assign(new Error("monthly limit"), { limit: true }));
    azAdd(cost);                                   // count before sending, so the limit can never be passed
    const pr = azFetch(clean, ja);
    azCache.set(key, pr);
    pr.catch(() => azCache.delete(key));
    if (azCache.size > 8) azCache.delete(azCache.keys().next().value);
    return pr;
  }
  function speakAzure(g, grp, st, next, fallback) {
    if (!/[\p{L}\p{N}]/u.test(grp.text.replace(/https?:\/\/\S+/g, ""))) { next(); return; }
    const at = idx, job = azGet(grp.text, grp.ja);
    if (parts[at + grp.n]) { const nx = azGroup(at + grp.n); azGet(nx.text, nx.ja).catch(() => {}); }   // one group ahead only: unused audio still counts
    let waitT = setTimeout(() => { if (g === gen && playing) show(`⏳ Azure voice… ${at + 1}/${parts.length}`); }, 900);
    job.then((blob) => {
      clearTimeout(waitT);
      if (g !== gen || !playing) return;
      azFails = 0; show(`${at + 1}${grp.n > 1 ? "–" + (at + grp.n) : ""}/${parts.length}  ${grp.text}`);
      if (natUrl) URL.revokeObjectURL(natUrl);
      natUrl = URL.createObjectURL(blob);
      audio.src = natUrl; audio.volume = 1; audio.muted = false;
      audio.playbackRate = Math.max(0.5, Math.min(3, st.rate * speed));
      audio.onended = () => { if (g === gen) next(); };
      audio.onerror = () => { if (g === gen && playing) { log("voice-error", "Azure audio could not play - device voice used"); fallback(); } };
      audio.play().catch((e) => { if (g === gen && playing) { log("voice-error", "Azure: " + e.message + " - device voice used"); fallback(); } });
      $("vUse").textContent = azUseText();
    }).catch((e) => {
      clearTimeout(waitT);
      if (e.limit) azStopUsing(`Azure monthly limit reached (${azUsed().toLocaleString()} of ${AZ.cap.toLocaleString()} characters).`);
      else if (e.status === 401 || e.status === 403) azStopUsing(`Azure refused the key (error ${e.status}): check the key and region in ⚙.`);
      else {
        log("voice-error", "Azure failed after 3 tries: " + (e.message || e) + " - device voice used for this part");
        if (++azFails >= 3) azStopUsing("Azure could not be reached for 3 parts in a row (each tried 3 times).");
      }
      if (g === gen && playing) fallback();
    });
  }
  const azUseText = () => `Azure this month: ${azUsed().toLocaleString()} / ${AZ.cap.toLocaleString()} characters`;
  // settings box
  function azOpenSettings() {
    $("azKey").value = AZ.key; $("azRegion").value = AZ.region; $("azVoiceJa").value = AZ.voiceJa; $("azVoiceEn").value = AZ.voiceEn; $("azCap").value = AZ.cap;
    $("azUse").textContent = azUseText(); $("azbox").hidden = false;
  }
  $("azSave").onclick = () => {
    save("azKey", $("azKey").value.trim()); save("azRegion", $("azRegion").value.toLowerCase().replace(/[^a-z0-9]/g, "") || "japaneast");
    save("azVoiceJa", $("azVoiceJa").value); save("azVoiceEn", $("azVoiceEn").value);
    save("azCap", Math.max(0, Math.min(500000, Math.round(+$("azCap").value) || 450000)));
    azBlocked = false; azFails = 0; azCache.clear(); $("vNote").hidden = true; $("azbox").hidden = true;
    if (!AZ.key) return;
    engine = "azure"; save("engine", engine); $("vEngine").value = "azure"; log("voice", "Azure settings saved");
    // Check the key straight away with one tiny request, and say plainly whether it works.
    const k = AZ.key;
    if (/^https?:|\s|[^A-Za-z0-9]/.test(k) || k.length < 20) {
      azStopUsing("That doesn't look like an Azure key (a key is one long run of letters and numbers, no spaces, not a web address). Open ⚙ and paste KEY 1 again.");
      return;
    }
    azNote("Checking the Azure key…");
    azAdd(azCost("テスト"));
    azFetch("テスト", true, 1).then(() => {
      azNote("✓ Azure key works. Reading with the Azure voice."); log("voice", "Azure key check: OK");
      setTimeout(() => { if ($("vNote").textContent.startsWith("✓")) $("vNote").hidden = true; }, 6000);
      restartIfPlaying();
    }).catch((e) => {
      log("voice", "Azure key check failed: " + (e.status || e.message));
      if (e.status === 401 || e.status === 403) azStopUsing(`Azure refused the key (error ${e.status}). Check that the key was copied fully and the region is where the resource was made (japaneast).`);
      else azStopUsing(`Could not reach Azure with region "${AZ.region}" (${e.status || "network error"}). Check the region spelling in ⚙.`);
    });
  };
  // Show how long the pasted key is (not the key itself), so a wrong paste is obvious
  $("azKey").oninput = () => { const k = $("azKey").value.trim(); $("azLen").textContent = !k ? "" : /^https?:/.test(k) ? "⚠ This is a web address, not a key." : /[^A-Za-z0-9]/.test(k) ? "⚠ A key has only letters and numbers." : `${k.length} characters pasted` + (k.length < 20 ? " (too short for a key)" : ""); };
  $("azClose").onclick = () => { $("azbox").hidden = true; $("vEngine").value = engine; };
  $("azGear").onclick = azOpenSettings;

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
    // Tell the listener it's working while the audio is being made (the first sentence can take a while)
    let waited = false;
    const waitT = setTimeout(() => { waited = true; if (g === gen && playing) show(`⏳ Making natural voice… ${idx + 1}/${parts.length}`); }, 600);
    job.finally(() => clearTimeout(waitT)).catch(() => {});
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
      // Too slow on this device (audio takes much longer to make than to play): go back to the device voice.
      natModule && natModule.then((m) => {
        const s = m.stats();
        if (engine === "natural" && s.seconds > 6 && s.speed > 1.4) {
          engine = "device"; save("engine", engine); $("vEngine").value = "device";
          log("voice", `natural voice is too slow on this device (${s.speed.toFixed(1)} s of work per 1 s of audio) - switched back to Device`);
          $("vNote").textContent = "Natural voice is too slow on this device - using the Device voice."; $("vNote").hidden = false;
          natCache.clear();
        }
      }).catch(() => {});
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
    log("voice", `JA voice: ${engine}, app version ${window.ATSU_VERSION || "?"}`);
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
  $("vEngine").onchange = (e) => { $("vNote").hidden = true;
    if (e.target.value === "azure" && !AZ.key) { azOpenSettings(); return; }     // first time: ask for the key
    azBlocked = false; engine = e.target.value; save("engine", engine); natFails = 0; log("voice", "Japanese voice: " + engine); restartIfPlaying(); };
  $("vStyle").onchange = (e) => { style = e.target.value; save("style", style); restartIfPlaying(); };
  $("vEn").onchange = (e) => { voiceEn = e.target.value; save("voiceEn", voiceEn); restartIfPlaying(); };
  $("vJa").onchange = (e) => { voiceJa = e.target.value; save("voiceJa", voiceJa); restartIfPlaying(); };
  $("vSlower").onclick = () => { speed = Math.max(0.5, Math.round((speed - 0.1) * 10) / 10); save("speed", speed); fillSelects(); restartIfPlaying(); };
  $("vFaster").onclick = () => { speed = Math.min(2.5, Math.round((speed + 0.1) * 10) / 10); save("speed", speed); fillSelects(); restartIfPlaying(); };
  if (synth) synth.onvoiceschanged = () => { if (!$("player").hidden) fillSelects(); };
  addEventListener("beforeunload", () => synth && synth.cancel());

  return { open, close, stop, replace, jump, split, splitLang, isOpen: () => !$("player").hidden, parts: () => parts };
})();
