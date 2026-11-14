// src/model_cache.js
var MODEL_CACHE = "yomiscript-models";
var OLD_CACHES = ["yomiscript-models-1"];
var HF = "https://huggingface.co/";
var RESOLVE = "/resolve/";
var COMMIT = /^[0-9a-f]{40}$/;
var revisionApiUrl = (base) => {
  const at = base.indexOf(RESOLVE);
  if (!base.startsWith(HF) || at <= HF.length || !base.endsWith("/")) return null;
  const rest = base.slice(at + RESOLVE.length), revision = rest.slice(0, rest.indexOf("/"));
  return revision ? `${HF}api/models/${base.slice(HF.length, at)}/revision/${revision}` : null;
};
var pinnedBase = (base, sha) => base.replace(/\/resolve\/[^/]+\//, `/resolve/${sha}/`);
var resolveCommit = async (base) => {
  const api = revisionApiUrl(base);
  if (!api) return null;
  try {
    const r = await fetch(api, { cache: "no-cache" });
    const sha = r.ok ? (await r.json()).sha : null;
    return COMMIT.test(sha) ? sha : null;
  } catch {
    return null;
  }
};
var openCache = async () => {
  try {
    return await caches.open(MODEL_CACHE);
  } catch {
    return null;
  }
};
var dropOldCaches = async () => {
  try {
    await Promise.all(OLD_CACHES.map((name) => caches.delete(name)));
  } catch {
  }
};
var dropOtherCommits = async (cache, base, sha) => {
  try {
    const repository = base.slice(0, base.indexOf(RESOLVE) + RESOLVE.length), current = `${repository}${sha}/`;
    const stale = (await cache.keys()).filter((q) => q.url.startsWith(repository) && !q.url.startsWith(current));
    await Promise.all(stale.map((q) => cache.delete(q)));
  } catch {
  }
};
async function modelFetcher(base) {
  await dropOldCaches();
  const sha = await resolveCommit(base);
  const cache = sha && await openCache();
  if (!cache) return (path) => fetch(base + path);
  const pinned = pinnedBase(base, sha);
  await dropOtherCommits(cache, base, sha);
  return async (path) => {
    const url = pinned + path;
    const hit = await cache.match(url).catch(() => void 0);
    if (hit) return hit;
    const r = await fetch(url);
    if (r.ok) cache.put(url, r.clone()).catch(() => {
    });
    return r;
  };
}
var modelBytes = (fetchModel) => async (path) => {
  const r = await fetchModel(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

// node_modules/@yomiscript/core/dist/yomiscript.js
var LANG = "[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*";
var UTT = new RegExp(`^(${LANG})\\s*/(.*?)\\s*([\u2198\u2197])\\s*/$`, "s");
var TAG = new RegExp(`\\{(${LANG}) ([^{}]*)\\}`, "g");
var isJa = (l) => l === "ja" || l.startsWith("ja-");
var VOWELS = "aeiou\xE6\u0251\u0252\u0254\u0259\u025A\u025B\u025C\u026A\u028A\u028C\u1D4A\u0250\xF8\u0153";
var SEPS = { "|": "#", "\u2016": "_" };
var SEP = (s) => s !== void 0 && SEPS[s] || null;
var inStr = (ch, s) => s.includes(ch);
function f0At(s, i) {
  if (!s.startsWith("<f0:", i)) return null;
  const j = s.indexOf(">", i);
  if (j < 0) throw new Error(`unclosed <f0: in ${JSON.stringify(s)}`);
  const v = s.slice(i + 4, j).split(",").map(Number);
  if (v.some((x) => isNaN(x))) throw new Error(`bad pitch value ${s.slice(i, j + 1)}`);
  return [v, j + 1];
}
function whyNot(s) {
  if (!s) return "empty input";
  if (/^\^|[$?]$/.test(s)) return "old notation (^\u2026$ / ^lang|\u2026); write  <lang> /\u2026 \u2198/";
  if (!new RegExp(`^${LANG}\\s*/`).test(s)) return 'missing language tag before the opening "/" (e.g. "ja /")';
  if (!/\/\s*$/.test(s)) return 'missing closing "/"';
  if (!/[↘↗]\s*\/\s*$/.test(s)) return 'missing sentence-final \u2198 or \u2197 before the closing "/"';
  return "not YomiScript";
}
function takeTexts(ys) {
  let out = "";
  const map = [], texts = [];
  for (let i = 0; i < ys.length; ) {
    if (ys.startsWith("<t:", i)) {
      const j = ys.indexOf(">", i);
      if (j < 0) throw new Error(`unclosed <t: in ${JSON.stringify(ys)}`);
      texts.push({ text: ys.slice(i + 3, j), at: out.length });
      i = j + 1;
    } else {
      map.push(i);
      out += ys[i++];
    }
  }
  map.push(ys.length);
  return { out, map, texts };
}
function spanOf(texts, t) {
  if (t.kind !== "unit" || !texts.length || t.end === void 0) return;
  const end = t.end;
  const k = texts.findIndex((x) => x.at >= end);
  if (k >= 0) t.span = k;
}
function mapOffsets(map, t) {
  if (typeof t.start === "number") t.start = map[t.start];
  if (t.end !== void 0 && t.end > 0) t.end = map[t.end - 1] + 1;
  if (t.vend !== void 0 && t.vend > 0) t.vend = map[t.vend - 1] + 1;
}
function placeTexts(S, T) {
  for (const sec of S) {
    sec.base = T.map[sec.base];
    for (const t of sec.toks) {
      spanOf(T.texts, t);
      mapOffsets(T.map, t);
    }
  }
}
function splitSections(top, b, b0) {
  const P = [];
  let pos = 0;
  for (const mm of b.matchAll(TAG)) {
    const at = mm.index ?? 0;
    P.push([top, pos, b.slice(pos, at)], [mm[1], at + mm[1].length + 2, mm[2]]);
    pos = at + mm[0].length;
  }
  P.push([top, pos, b.slice(pos)]);
  const S = [];
  for (const [l, s, x] of P) {
    let a = 0, z = x.length;
    while (a < z && inStr(x[a], " |\u2016")) a++;
    while (z > a && inStr(x[z - 1], " |\u2016")) z--;
    if (a < z) S.push({ lang: l, text: x.slice(a, z), base: b0 + s + a });
  }
  return S;
}
function parse(written) {
  written = written.trim();
  const T = takeTexts(written), ys = T.out;
  const m = ys.match(UTT);
  if (!m) throw new Error(`${whyNot(ys)} \u2014 got ${JSON.stringify(ys.length > 60 ? ys.slice(0, 60) + "\u2026" : ys)}. YomiScript looks like  ja /k\u02B2o\uA71C\u02D0wa | a\uA71Cme\u0261a \u2198/`);
  const top = m[1], end = m[3] === "\u2197" ? "?" : "$";
  const parts = splitSections(top, m[2], ys.indexOf("/") + 1);
  const S = parts.map((p, i) => {
    const sec = { ...p, end: i === parts.length - 1 ? end : "$", toks: segment(p.lang, p.text, p.base) };
    const last = [...sec.toks].reverse().find((t) => t.kind !== "bound");
    sec.toks.push({ kind: "end", sym: endSym(sec.end, last), ph: last ? last.ph : 0 });
    return sec;
  });
  placeTexts(S, T);
  return { ys: written, top, end, sections: S, texts: T.texts.map((x) => x.text) };
}
function endSym(end, last) {
  if (end === "?") return "?";
  return last?.kind === "punct" ? "" : ".";
}
function segment(lang, t, base) {
  if (isJa(lang)) return jaSeg(t, base);
  return lang === "zh" ? zhSeg(t, base) : euSeg(t, base);
}
var JV = "ai\u026Feou\u0268";
var JNAS = "mn\u0272\u014B\u0274";
var DEVOICE = "\u0325";
var JAFF = ["t\u0255", "d\u0291", "ts", "dz", "\u02A8", "\u02A5", "\u02A6", "\u02A3"];
var JCONS = "k\u0261s\u0255ztdn\u0272h\xE7\u0278bpmjw\u027Ev\u0294\u014B\u0274\u0291\u03B2";
function jaTokens(c, base) {
  const T = [];
  for (let i = 0; i < c.length; ) {
    const ch = c[i], at = base + i;
    if (ch === "." || ch === " ") {
      i++;
      continue;
    }
    const f = f0At(c, i);
    if (f) {
      T.push({ t: "F", v: f[0] });
      i = f[1];
      continue;
    }
    if (ch === "\uA71B" || ch === "\uA71C") {
      T.push({ t: ch });
      i++;
      continue;
    }
    if (ch === "\u02D0") {
      T.push({ t: "R", s: "\u02D0", end: at + 1 });
      i++;
      continue;
    }
    if (inStr(ch, JV)) {
      let dev = false;
      i++;
      if (c[i] === DEVOICE) {
        dev = true;
        i++;
      }
      T.push({ t: "V", s: ch, dev, vend: at + 1, end: base + i });
      continue;
    }
    const [s, j] = jaConsonant(c, i);
    i = j;
    T.push({ t: "C", s, end: base + i });
  }
  return T;
}
function jaConsonant(c, i) {
  const ch = c[i], two = c.slice(i, i + 2);
  let s = ch;
  if (JAFF.includes(two)) s = two;
  else if (ch === "g")
    s = "\u0261";
  else if (!JAFF.includes(ch) && !inStr(ch, JCONS)) {
    const kana = /[぀-ヿ]/.test(ch) ? " (kana is not YomiScript; write IPA with \uA71B \uA71C)" : "";
    throw new Error(`not Japanese YomiScript IPA: ${JSON.stringify(ch)} in ${JSON.stringify(c)}${kana}`);
  }
  i += JAFF.includes(two) ? 2 : 1;
  if (c[i] === "\u02B2" || c[i] === "\u02B7") return [s + c[i], i + 1];
  return [s, i];
}
function jaMoras(c, base) {
  const T = jaTokens(c, base), M = [];
  let on = "";
  const next = (i) => {
    for (let j = i + 1; j < T.length; j++) if (T[j].t === "C" || T[j].t === "V" || T[j].t === "R") return T[j];
    return null;
  };
  const add = (o) => M.push({ rise: false, fall: false, f0: null, dev: false, ...o });
  T.forEach((x, i) => {
    if (x.t === "\uA71B" || x.t === "\uA71C" || x.t === "F") {
      markLast(M, x, on, c);
      return;
    }
    if (x.t === "R") {
      add({ kind: "R", ipa: "\u02D0", end: x.end });
      return;
    }
    const s = x.s ?? "";
    if (x.t === "V") {
      add({ kind: "mora", on, v: s, ipa: on + s, dev: x.dev, vend: x.vend, end: x.end });
      on = "";
      return;
    }
    const kind = on ? null : specialMora(s, next(i));
    if (kind) {
      add({ kind, ipa: s, end: x.end });
      return;
    }
    if (on && !inStr(s, "jw")) throw new Error(`unexpected consonant cluster ${on}${s} in ${JSON.stringify(c)}`);
    on += s;
  });
  if (on) throw new Error(`consonant ${on} without a vowel in ${JSON.stringify(c)}`);
  return M;
}
function markLast(M, x, on, c) {
  if (x.t === "F") {
    if (on || !M.length) throw new Error(`<f0:\u2026> must follow a mora in ${JSON.stringify(c)}`);
    M[M.length - 1].f0 = x.v;
    return;
  }
  if (on) throw new Error(`accent mark inside a mora in ${JSON.stringify(c)}`);
  if (M.length) M[M.length - 1][x.t === "\uA71B" ? "rise" : "fall"] = true;
}
function specialMora(s, n) {
  if (s === "\u0274") return "N";
  if (s === "\u0294") return "Q";
  if (inStr(s, JNAS) && n?.t !== "V") return "N";
  if (n?.t === "C" && !inStr(s, "jw") && !inStr(n.s ?? "", "jw")) return "Q";
  return null;
}
function jaWordSpans(t) {
  const W = [];
  for (let i = 0, s = -1; i <= t.length; i++) {
    const c = t[i];
    if (i === t.length || c === " " || SEP(c)) {
      if (s >= 0) W.push([s, i]);
      s = -1;
      if (c && SEP(c)) W.push([i, i + 1]);
    } else if (s < 0) s = i;
  }
  return W;
}
function jaWordItems(w, at) {
  const items = [];
  for (let i = 0, s = 0; i <= w.length; ) {
    const p = i < w.length ? pAt(w, i) : null;
    if (i === w.length || p) {
      if (i > s) items.push(...jaMoras(w.slice(s, i), at + s));
      if (!p) break;
      items.push({ kind: "punct", sym: p[0] });
      i = s = p[1];
    } else i = w.startsWith("<f0:", i) ? w.indexOf(">", i) + 1 || w.length : i + 1;
  }
  return items;
}
function jaSeg(t, base) {
  const out = [];
  let ph = 0, chunk = 0, cur = [];
  const flush = () => {
    const M = cur.filter((x) => x.kind !== "space" && x.kind !== "punct"), hasRise = M.some((m) => m.rise);
    let k = 0;
    for (const x of cur)
      out.push(x.kind === "space" || x.kind === "punct" ? { ...x, ph } : { ...x, mk: x.kind, kind: "unit", lang: "ja", ph, chunk, k: k++, hasRise });
    if (M.length) chunk++;
    cur = [];
  };
  for (const [a, z] of jaWordSpans(t)) {
    const w = t.slice(a, z), b = boundary(w, ph, true);
    if (b) {
      flush();
      out.push(...b.filter((x) => x.kind !== "bound" || x.sym === "#"));
      ph++;
      continue;
    }
    const L = cur.length ? cur[cur.length - 1] : lastTok(out);
    if (L && L.kind !== "pause") cur.push({ kind: "space" });
    cur.push(...jaWordItems(w, base + a));
  }
  flush();
  return out;
}
var lastTok = (out) => [...out].reverse().find((x) => x.kind !== "bound");
function boundary(w, ph, sent = false) {
  const sep = SEP(w);
  if (sep)
    return sep === "_" ? [
      { kind: "bound", sym: sep, ph },
      { kind: "pause", ph }
    ] : [{ kind: "bound", sym: sep, ph }];
  if (w === "\u2198" || w === "\u2197") return [{ kind: "punct", sym: w === "\u2197" ? "?" : ".", ...sent ? { sent } : {}, ph }];
  return null;
}
function words(t, base, unit) {
  const out = [];
  let ph = 0, pos = 0;
  for (const w of t.split(" ")) {
    const o = base + pos;
    pos += w.length + 1;
    if (!w) continue;
    const b = boundary(w, ph);
    if (b) {
      out.push(...b);
      ph++;
      continue;
    }
    const L = lastTok(out);
    if (L && L.kind !== "pause") out.push({ kind: "space", ph });
    out.push(...unit(w, o, ph));
  }
  return out;
}
function pAt(s, i) {
  if (!s.startsWith("<p:", i)) return null;
  const j = s.indexOf(">", i + 3);
  if (j < 0) throw new Error(`unclosed <p: in ${JSON.stringify(s)}`);
  return [s.slice(i + 3, j), j + 1];
}
function sylls(w, base) {
  const R = [];
  let raw = "", start2 = base, f0 = null, end = base;
  const flush = () => {
    if (raw || f0) R.push({ raw, start: start2, end, f0 });
    raw = "";
    f0 = null;
  };
  for (let i = 0; i <= w.length; ) {
    if (i === w.length || w[i] === ".") {
      flush();
      start2 = base + i + 1;
      end = start2;
      i++;
      continue;
    }
    const f = f0At(w, i);
    if (f) {
      f0 = f[0];
      i = f[1];
      continue;
    }
    const p = pAt(w, i);
    if (p) {
      flush();
      R.push({ punct: p[0] });
      i = p[1];
      start2 = end = base + i;
      continue;
    }
    if (w[i] !== "\u203F") raw += w[i];
    i++;
    end = base + i;
  }
  return R;
}
function euSeg(t, base) {
  return words(t, base, (w, o, ph) => {
    const S = sylls(w, o), N = S.filter((s) => !("punct" in s)).length;
    let j = 0;
    return S.map((s) => {
      if ("punct" in s) return { kind: "punct", sym: s.punct, ph };
      return { kind: "unit", ph, j: j++, nsyl: N, st: inStr(s.raw[0] ?? "", "\u02C8\u02CC") ? s.raw[0] : "", ...s };
    });
  });
}
function zhSeg(t, base) {
  return words(
    t,
    base,
    (w, o, ph) => sylls(w, o).map((s) => {
      if ("punct" in s) return { kind: "punct", sym: s.punct, ph };
      const m = s.raw.match(/^[a-zü]+(\d)(?:>(\d))?/);
      if (!m) throw new Error(`bad pinyin syllable ${JSON.stringify(s.raw)}`);
      return { kind: "unit", ph, tone: m[2] || m[1], ...s };
    })
  );
}

// node_modules/@yomiscript/kokoro/dist/vocab.js
var VOCAB = {
  ";": 1,
  ":": 2,
  ",": 3,
  ".": 4,
  "!": 5,
  "?": 6,
  "\u2014": 9,
  "\u2026": 10,
  '"': 11,
  "(": 12,
  ")": 13,
  "\u201C": 14,
  "\u201D": 15,
  " ": 16,
  "\u0303": 17,
  \u02A3: 18,
  \u02A5: 19,
  \u02A6: 20,
  \u02A8: 21,
  "\u1D5D": 22,
  "\uAB67": 23,
  A: 24,
  I: 25,
  O: 31,
  Q: 33,
  S: 35,
  T: 36,
  W: 39,
  Y: 41,
  "\u1D4A": 42,
  a: 43,
  b: 44,
  c: 45,
  d: 46,
  e: 47,
  f: 48,
  h: 50,
  i: 51,
  j: 52,
  k: 53,
  l: 54,
  m: 55,
  n: 56,
  o: 57,
  p: 58,
  q: 59,
  r: 60,
  s: 61,
  t: 62,
  u: 63,
  v: 64,
  w: 65,
  x: 66,
  y: 67,
  z: 68,
  \u0251: 69,
  \u0250: 70,
  \u0252: 71,
  \u00E6: 72,
  \u03B2: 75,
  \u0254: 76,
  \u0255: 77,
  \u00E7: 78,
  \u0256: 80,
  \u00F0: 81,
  \u02A4: 82,
  \u0259: 83,
  \u025A: 85,
  \u025B: 86,
  \u025C: 87,
  \u025F: 90,
  \u0261: 92,
  \u0265: 99,
  \u0268: 101,
  \u026A: 102,
  \u029D: 103,
  \u026F: 110,
  \u0270: 111,
  \u014B: 112,
  \u0273: 113,
  \u0272: 114,
  \u0274: 115,
  \u00F8: 116,
  \u0278: 118,
  \u03B8: 119,
  \u0153: 120,
  \u0279: 123,
  \u027E: 125,
  \u027B: 126,
  \u0281: 128,
  \u027D: 129,
  \u0282: 130,
  \u0283: 131,
  \u0288: 132,
  \u02A7: 133,
  \u028A: 135,
  \u028B: 136,
  \u028C: 138,
  \u0263: 139,
  \u0264: 140,
  \u03C7: 142,
  \u028E: 143,
  \u0292: 147,
  \u0294: 148,
  "\u02C8": 156,
  "\u02CC": 157,
  \u02D0: 158,
  \u02B0: 162,
  \u02B2: 164,
  "\u2193": 169,
  "\u2192": 171,
  "\u2197": 172,
  "\u2198": 173,
  "\u1D7B": 177
};

// node_modules/@yomiscript/kokoro/dist/plan.js
var SR = 24e3;
var BLEND = 0.2;
var VOICE = {
  ja: "jf_alpha",
  "en-US": "af_heart",
  "en-GB": "bf_emma",
  en: "af_heart",
  fr: "ff_siwis",
  zh: "zf_xiaoxiao"
};
var voiceOf = (l) => {
  const v = VOICE[l] ?? VOICE[l.split("-")[0]];
  if (!v)
    throw new Error(`this Katarite does not support language ${l}`);
  return v;
};
function jaKokoro(on, v) {
  on = on.replace("t\u0255", "\u02A8").replace("d\u0291", "\u02A5").replace("ts", "\u02A6").replace("w", "\u03B2").replace("\u02B7", "\u1D5D");
  if (on === "dz" || on === "\u02A3")
    on = "\u02A3";
  if (v === "i" && /^[kɡbpmɾvɸtdʦ]$/.test(on))
    on += "\u02B2";
  if (v === "\u026F" && (/ʲ$/.test(on) || /^[ɕʥʨçsʦɲ]$/.test(on)))
    v = "\u0268";
  if (v === "\u026F" && on === "\u02A3") {
    on = "z";
    v = "\u0268";
  }
  return on + v;
}
var FOREIGN_JA = { \u0268: "u", \u0255: "\u0283", \u0291: "\u0292", \u02A8: "\u02A7", \u02A5: "\u02A4" };
var INI = [
  ["zh", "\u0288\u0282"],
  ["ch", "\u0288\u0282\u02B0"],
  ["sh", "\u0282"],
  ["b", "p"],
  ["p", "p\u02B0"],
  ["m", "m"],
  ["f", "f"],
  ["d", "t"],
  ["t", "t\u02B0"],
  ["n", "n"],
  ["l", "l"],
  ["g", "k"],
  ["k", "k\u02B0"],
  ["h", "x"],
  ["j", "\u02A8"],
  ["q", "\u02A8\u02B0"],
  ["x", "\u0255"],
  ["r", "\u027B"],
  ["z", "\u02A6"],
  ["c", "\u02A6\u02B0"],
  ["s", "s"],
  ["y", ""],
  ["w", ""]
];
var FIN = {
  a: "a",
  o: "wo",
  e: "\u0264",
  ai: "aI",
  ei: "eI",
  ao: "a\u028A",
  ou: "o\u028A",
  an: "an",
  en: "\u0259n",
  ang: "a\u014B",
  eng: "\u0259\u014B",
  ong: "\u028A\u014B",
  er: "\u025A",
  i: "i",
  ia: "ja",
  ie: "je",
  iao: "ja\u028A",
  iu: "jo\u028A",
  ian: "j\u025Bn",
  in: "in",
  iang: "ja\u014B",
  ing: "i\u014B",
  iong: "j\u028A\u014B",
  u: "u",
  ua: "wa",
  uo: "wo",
  uai: "waI",
  ui: "weI",
  uan: "wan",
  un: "w\u0259n",
  uang: "wa\u014B",
  v: "y",
  ue: "\u0265e",
  ve: "\u0265e",
  uan_j: "\u0265\u025Bn",
  un_j: "yn"
};
var TONE = { 1: "\u2192", 2: "\u2197", 3: "\u2193", 4: "\u2198", 5: "" };
function zsyl(syl) {
  const m = syl.match(/^([a-zü]+)(\d)(?:>(\d))?/);
  if (!m)
    throw new Error(`bad pinyin syllable ${JSON.stringify(syl)}`);
  const py = m[1], t = m[3] || m[2];
  let ini = "", ip = "";
  for (const [a, b] of INI)
    if (py.startsWith(a)) {
      ini = a;
      ip = b;
      break;
    }
  return ip + zhFinal(ini, py.slice(ini.length)) + TONE[t];
}
var Y_FIN = { u: "v", ue: "ve", uan: "uan_j", un: "un_j", i: "i", in: "in", ing: "ing" };
var JQX_FIN = { u: "v", ue: "ve", uan: "uan_j", un: "un_j" };
function zhFinal(ini, f) {
  if (ini === "y")
    f = Y_FIN[f] ?? (f.startsWith("i") ? f : "i" + f);
  if (ini === "w" && f !== "u")
    f = "u" + f;
  if (["j", "q", "x"].includes(ini) && f.startsWith("u"))
    f = JQX_FIN[f];
  if (f === "i" && ["z", "c", "s"].includes(ini))
    return "\u0279";
  if (f === "i" && ["zh", "ch", "sh", "r"].includes(ini))
    return "\u027B";
  return FIN[f] ?? f;
}
var KOKORO_VOWELS = "AIOQWY" + VOWELS;
var EN_SYMBOLS = [
  ["g", "\u0261"],
  ["t\u0283", "\u02A7"],
  ["d\u0292", "\u02A4"],
  ["e\u026A", "A"],
  ["a\u026A", "I"],
  ["a\u028A", "W"],
  ["\u0254\u026A", "Y"],
  ["o\u028A", "O"],
  ["\u0259\u028A", "Q"],
  ["r", "\u0279"],
  ["l\u0329", "\u1D4Al"],
  ["x", "k"],
  ["\u027E", "T"]
  // Kokoro's English flap token is T
];
function enSyl(x, gb) {
  for (const [a, b] of EN_SYMBOLS)
    x = x.split(a).join(b);
  x = x.split("\u025D").join(gb ? "\u025C\u02D0" : "\u025C\u0279").split("\u025A").join(gb ? "\u0259" : "\u0259\u0279");
  let st = "";
  if (x[0] === "\u02C8" || x[0] === "\u02CC") {
    st = x[0];
    x = x.slice(1);
  }
  if (st) {
    const i = x.split("").findIndex((c) => KOKORO_VOWELS.includes(c));
    x = i >= 0 ? x.slice(0, i) + st + x.slice(i) : st + x;
  }
  return x;
}
function jaPhonemes(t, foreign, original) {
  if (t.kind === "space")
    return " ";
  if (t.kind === "pause")
    return original ? " " : ", ";
  if (t.kind === "end" || t.kind === "punct")
    return t.sym === "." && (t.kind === "end" || original && t.sent) ? "" : t.sym ?? "";
  let p = t.ipa ?? "";
  if (t.mk === "mora")
    p = jaKokoro(t.on ?? "", t.v ?? "");
  else if (t.mk === "Q")
    p = "\u0294";
  return foreign ? [...p].map((c) => FOREIGN_JA[c] ?? c).join("") : p;
}
function kokoroPhonemes(lang, t, foreign, original) {
  if (isJa(lang))
    return jaPhonemes(t, foreign, original);
  if (t.kind === "space")
    return " ";
  if (t.kind === "pause")
    return ", ";
  if (t.kind === "end" || t.kind === "punct")
    return t.sym ?? "";
  const raw = t.raw ?? "";
  if (lang === "zh" || lang.startsWith("zh-"))
    return zsyl(raw);
  if (lang === "fr" || lang.startsWith("fr-"))
    return raw.replace(/g/g, "\u0261");
  return enSyl(raw, lang === "en-GB");
}
function voiceFor(top, l, x) {
  if (l === top)
    return voiceOf(top);
  if (x.split(/\s+/).filter(Boolean).length === 1 && (isJa(top) || !isJa(l)))
    return voiceOf(l);
  return `${voiceOf(top)}+${voiceOf(l)}@${BLEND}`;
}
var N_BEFORE_VOWEL = 1.5;
var VOWEL_AFTER_N = 1.25;
function lengthening(toks, ja) {
  const out = toks.map(() => 1);
  if (!ja)
    return out;
  toks.forEach((t, k) => {
    const n = toks[k + 1];
    if (t.kind !== "unit" || t.mk !== "N" || n?.kind !== "unit" || n.mk !== "mora" || n.on)
      return;
    out[k] = N_BEFORE_VOWEL;
    out[k + 1] = VOWEL_AFTER_N;
  });
  return out;
}
var GEMINATE_MIN_STEPS = 3;
function minimumSteps(toks, uid, ja) {
  const out = uid.map(() => 0);
  if (!ja)
    return out;
  toks.forEach((t, k) => {
    if (t.kind !== "unit" || t.mk !== "Q")
      return;
    uid.forEach((u, i) => {
      if (u === k)
        out[i] = GEMINATE_MIN_STEPS;
    });
    const before = toks[k - 1];
    if (before?.kind === "unit" && before.mk === "mora")
      out[uid.lastIndexOf(k - 1)] = GEMINATE_MIN_STEPS;
  });
  return out;
}
function spokenSteps(predicted, sec) {
  return Array.from(predicted, Number).map((d, i) => Math.max(Math.round(d * (sec.lengthen[sec.uid[i]] ?? 1)), sec.minSteps[i]));
}
function plan(ys, opts = {}) {
  const Y = parse(ys);
  const P = Y.sections.map((sec) => {
    const foreign = isJa(sec.lang) && !isJa(Y.top);
    const U = [], toks = [];
    for (const t of sec.toks) {
      if (t.kind === "bound")
        continue;
      U.push([kokoroPhonemes(sec.lang, t, foreign, opts.original ?? false), t.kind === "unit" && t.f0 ? [...t.f0] : null, t.ph]);
      toks.push(t);
    }
    const ids = [0], uid = [-1];
    U.forEach(([p], k) => {
      for (const ch of p)
        if (ch in VOCAB) {
          ids.push(VOCAB[ch]);
          uid.push(k);
        }
    });
    ids.push(0);
    uid.push(-1);
    const ps = U.map((u) => u[0]).join("");
    const adjusted = isJa(sec.lang) && !opts.original, lengthen = lengthening(toks, adjusted), minSteps = minimumSteps(toks, uid, adjusted);
    return { lang: sec.lang, text: sec.text, voice: voiceFor(Y.top, sec.lang, sec.text), ps, ids, uid, U, toks, lengthen, minSteps };
  });
  return Object.assign(P, { src: Y.ys });
}

// node_modules/@yomiscript/kokoro/dist/render.js
var mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function unitFrames(uid, dur, n) {
  const fu = [];
  dur.forEach((d, l) => {
    for (let r = 0; r < d * 2; r++)
      fu.push(uid[l]);
  });
  fu.length = Math.min(fu.length, n);
  return fu;
}
function valueAt(c, x) {
  if (c.length === 1)
    return c[0];
  const pos = x * (c.length - 1), a = Math.min(Math.floor(pos), c.length - 2);
  return c[a] + (c[a + 1] - c[a]) * (pos - a);
}
function frameTargets(fu, U, n, dstep) {
  const st = new Float64Array(n).fill(NaN);
  U.forEach(([, c, ph], k) => {
    if (c === null)
      return;
    const fr = [];
    for (let i = 0; i < fu.length; i++)
      if (fu[i] === k)
        fr.push(i);
    fr.forEach((i, j) => st[i] = valueAt(c, fr.length > 1 ? j / (fr.length - 1) : 0) - dstep * ph);
  });
  return st;
}
function anchorPhrases(st, f0, fu, U) {
  const n = f0.length, lo = Array.from(f0, (v) => Math.log2(Math.max(v, 1)) * 12);
  const phr = Array.from({ length: n }, (_, i) => i < fu.length && fu[i] >= 0 ? U[fu[i]][2] : -1);
  const ok = Array.from({ length: n }, (_, i) => !isNaN(st[i]) && f0[i] > 60);
  const tgt = new Float64Array(n).fill(NaN);
  for (const ph of new Set(phr.filter((_, i) => ok[i]))) {
    const sel = [];
    for (let i = 0; i < n; i++)
      if (ok[i] && phr[i] === ph)
        sel.push(i);
    const ms = mean(sel.map((i) => st[i])), ml = mean(sel.map((i) => lo[i]));
    for (const i of sel)
      tgt[i] = st[i] - ms + ml;
  }
  return tgt;
}
function interpolate(tgt, xs) {
  const n = tgt.length, full = new Float64Array(n);
  let q = 0;
  for (let i = 0; i < n; i++) {
    if (i <= xs[0])
      full[i] = tgt[xs[0]];
    else if (i >= xs[xs.length - 1])
      full[i] = tgt[xs[xs.length - 1]];
    else {
      while (xs[q + 1] < i)
        q++;
      const a = xs[q], b = xs[q + 1];
      full[i] = tgt[a] + (tgt[b] - tgt[a]) * (i - a) / (b - a);
    }
  }
  return full;
}
function movingAverage(full, smooth) {
  const n = full.length, h = smooth >> 1, sm = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -h; j <= h; j++)
      s += full[Math.min(n - 1, Math.max(0, i + j))];
    sm[i] = s / smooth;
  }
  return sm;
}
function f0Override(f0, uid, dur, U, smooth = 5, dstep = 0.6) {
  const fu = unitFrames(uid, dur, f0.length);
  const tgt = anchorPhrases(frameTargets(fu, U, f0.length, dstep), f0, fu, U);
  const xs = [];
  for (let i = 0; i < f0.length; i++)
    if (!isNaN(tgt[i]))
      xs.push(i);
  if (!xs.length)
    return Float32Array.from(f0);
  const sm = movingAverage(interpolate(tgt, xs), smooth);
  return Float32Array.from(f0, (v, i) => isNaN(tgt[i]) ? v : 2 ** (sm[i] / 12));
}
var rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
function trim(a, lead = true, th = 0.01) {
  let i0 = -1, i1 = -1;
  for (let i = 0; i < a.length; i++)
    if (Math.abs(a[i]) > th) {
      if (i0 < 0)
        i0 = i;
      i1 = i;
    }
  if (i0 < 0)
    return a;
  return a.slice(lead ? Math.max(i0 - 240, 0) : 0, Math.min(a.length, i1 + 480));
}
function join(P) {
  const tgt = rms(P[0]);
  let out = Float32Array.from(trim(P[0], false));
  const n = Math.round(0.015 * SR), gap = Math.round(0.06 * SR);
  for (const p0 of P.slice(1)) {
    const g = tgt / Math.max(rms(p0), 1e-6);
    const p = Float32Array.from(trim(p0), (v) => v * g);
    for (let i = 0; i < n && i < out.length; i++)
      out[out.length - n + i] *= 1 - i / (n - 1);
    for (let i = 0; i < n && i < p.length; i++)
      p[i] *= i / (n - 1);
    const o = new Float32Array(out.length + gap + p.length);
    o.set(out);
    o.set(p, out.length + gap);
    out = o;
  }
  let mx = 0;
  for (const v of out)
    mx = Math.max(mx, Math.abs(v));
  const k = Math.max(1, mx / 0.95);
  return out.map((v) => v / k);
}
function wav(a, sr = SR) {
  const b = new ArrayBuffer(44 + a.length * 2), d = new DataView(b);
  const w = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  d.setUint32(4, 36 + a.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, sr, true);
  d.setUint32(28, sr * 2, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  w(36, "data");
  d.setUint32(40, a.length * 2, true);
  a.forEach((v, i) => d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
  return b;
}

// node_modules/@yomiscript/kokoro/dist/render_ja.js
function charFrames(dur) {
  const out = [];
  let t = 0;
  for (const d of dur) {
    out.push([t, t + d * 2]);
    t += d * 2;
  }
  return out;
}
function voicedSpan(f0, a, b) {
  let va = -1, vb = -1;
  for (let i = a; i < Math.min(b, f0.length); i++)
    if (f0[i] > 60) {
      if (va < 0)
        va = i;
      vb = i + 1;
    }
  return va < 0 ? [a, b] : [va, vb];
}
function points(f0, uid, dur, U, isMora) {
  const fr = charFrames(dur), P = [];
  let run = 0;
  U.forEach(([, c], k) => {
    if (!c) {
      if (isMora[k])
        run++;
      return;
    }
    const idx = uid.flatMap((u, l) => u === k ? [l] : []);
    if (!idx.length)
      return;
    const [a, b] = voicedSpan(f0, fr[idx[0]][0], fr[idx[idx.length - 1]][1]), vs = c.length === 1 ? [c[0], c[0]] : c;
    vs.forEach((v, j) => P.push({ x: Math.min(f0.length - 1, a + 0.5 + (b - a - 1) * j / (vs.length - 1)), v, run }));
  });
  return P;
}
function targets(P, n, shift) {
  const tgt = new Float64Array(n).fill(NaN);
  let q = 0;
  for (let i = 0; i < n; i++) {
    while (q < P.length - 2 && P[q + 1].x < i)
      q++;
    const [p, r] = [P[q], P[q + 1] ?? P[q]];
    if (i <= P[0].x)
      tgt[i] = P[0].v;
    else if (i >= P[P.length - 1].x)
      tgt[i] = P[P.length - 1].v;
    else if (p.run === r.run)
      tgt[i] = p.v + (r.v - p.v) * (i - p.x) / Math.max(r.x - p.x, 1e-6);
    tgt[i] += shift;
  }
  return tgt;
}
function smoothed(tgt, smooth) {
  const n = tgt.length, h = smooth >> 1, out = new Float64Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (isNaN(tgt[i]))
      continue;
    let s = 0, w = 0;
    for (let j = -h; j <= h; j++) {
      const v = tgt[Math.min(n - 1, Math.max(0, i + j))];
      if (!isNaN(v))
        [s, w] = [s + (h + 1 - Math.abs(j)) * v, w + h + 1 - Math.abs(j)];
    }
    out[i] = s / w;
  }
  return out;
}
function f0Japanese(f0, uid, dur, U, isMora, smooth = 7) {
  const P = points(f0, uid, dur, U, isMora);
  if (!P.length)
    return Float32Array.from(f0);
  const at = P.filter((p) => f0[Math.round(p.x)] > 60), st = (v) => Math.log2(Math.max(v, 1)) * 12, mean2 = (a) => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1);
  const shift = mean2(at.map((p) => st(f0[Math.round(p.x)]))) - mean2(P.map((p) => p.v));
  const sm = smoothed(targets(P, f0.length, shift), smooth);
  return Float32Array.from(f0, (v, i) => v > 60 && !isNaN(sm[i]) ? 2 ** (sm[i] / 12) : v);
}

// node_modules/@yomiscript/kokoro/dist/engine.js
var W16 = { enc: "_w16", f0n: "_w16", dec: "_w16" };
var Engine = class {
  V = {};
  enc;
  f0n;
  dec;
  ort;
  load;
  constructor(ort, load) {
    this.ort = ort;
    this.load = load;
  }
  async init(opts = {}) {
    const sf = opts.suffix ?? {}, executionProviders = opts.executionProviders ?? ["wasm"];
    const mk = async (n) => this.ort.InferenceSession.create(await this.load(`models/${n}${sf[n] ?? ""}.onnx`), { executionProviders });
    [this.enc, this.f0n, this.dec] = [await mk("enc"), await mk("f0n"), await mk("dec")];
    return this;
  }
  async voice(name) {
    if (this.V[name])
      return this.V[name];
    const m = name.match(/^([^+]+)\+([^@]+)@([\d.]+)$/);
    let v;
    if (m) {
      const a = await this.voice(m[1]), b = await this.voice(m[2]), w = +m[3];
      v = a.map((x, i) => x * (1 - w) + b[i] * w);
    } else {
      const bytes = await this.load(`voices/${name}.bin`);
      v = bytes instanceof ArrayBuffer ? new Float32Array(bytes) : new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    }
    this.V[name] = v;
    return v;
  }
  // Kokoro's own prosody prediction (durations, F0, energy) for one planned section; also used by the Yomite (prosody.ts).
  // durations: one per id, in steps, instead of the predicted ones (an experiment's input; YomiScript has none)
  async predict(sec, durations) {
    const T = this.ort.Tensor;
    const L = sec.ids.length;
    const V = await this.voice(sec.voice);
    const k = (sec.ps ?? "x".repeat(L - 1)).length - 1;
    const ref = new T("float32", V.slice(k * 256, (k + 1) * 256), [1, 256]);
    const r1 = await this.enc.run({ ids: new T("int64", BigInt64Array.from(sec.ids.map(BigInt)), [1, L]), ref });
    if (durations && durations.length !== L)
      throw new Error(`durations: ${durations.length} for ${L} ids`);
    const dur = durations ?? spokenSteps(r1.dur.data, sec);
    const Tn = dur.reduce((a, b) => a + b, 0);
    const expand = (t) => {
      const C = t.dims[1], src = t.data, out = new Float32Array(C * Tn);
      for (let c = 0; c < C; c++) {
        let q = c * Tn;
        for (let l = 0; l < L; l++) {
          const v = src[c * L + l];
          for (let r = 0; r < dur[l]; r++)
            out[q++] = v;
        }
      }
      return new T("float32", out, [1, C, Tn]);
    };
    const r2 = await this.f0n.run({ en: expand(r1.d), ref });
    return { ref, dur, t_en: expand(r1.t_en), f0: r2.F0.data, N: r2.N };
  }
  async synthSection(sec, pitch = "values", durations) {
    const T = this.ort.Tensor;
    const { ref, dur, t_en, f0, N } = await this.predict(sec, durations);
    const F = pitch === "engine" ? Float32Array.from(f0) : this.pitch(sec, f0, dur);
    const r3 = await this.dec.run({ asr: t_en, F0: new T("float32", F, [1, F.length]), N, ref });
    return { audio: Float32Array.from(r3.audio.data), f0: Float32Array.from(f0), f0new: F, dur };
  }
  /** the F0 the decoder gets: the YomiScript's values put into the engine's own (Japanese: render_ja.ts, D28) */
  pitch(sec, f0, dur) {
    if (!isJa(sec.lang))
      return f0Override(f0, sec.uid, dur, sec.U);
    return f0Japanese(f0, sec.uid, dur, sec.U, sec.toks.map((t) => t.kind === "unit"));
  }
  async synth(ys, pitch = "values") {
    const P = plan(ys);
    const outs = [];
    for (const s of P)
      outs.push((await this.synthSection(s, pitch)).audio);
    return { audio: outs.length === 1 ? outs[0] : join(outs), plan: P };
  }
};

// node_modules/@yomiscript/kokoro/dist/models.js
var KOKORO_MODELS_URL = "https://huggingface.co/receptron/yomiscript-kokoro/resolve/main/";

// src/worker.js
var ORT = new URL("ort/", self.location.href).href;
var WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\//.test(navigator.userAgent);
var threads = 1;
var gpu = false;
async function start() {
  const Q = new URL(self.location.href).searchParams;
  gpu = Q.get("ep") === "webgpu";
  const ort = await import(
    /* @vite-ignore */
    ORT + (gpu ? "ort.webgpu.min.mjs" : "ort.wasm.min.mjs")
  );
  ort.env.wasm.wasmPaths = ORT;
  const want = +Q.get("t") || 4;
  threads = self.crossOriginIsolated && !WEBKIT ? Math.max(1, Math.min(want, navigator.hardwareConcurrency || 1)) : 1;
  ort.env.wasm.numThreads = threads;
  const fetchModel = await modelFetcher(KOKORO_MODELS_URL);
  let got = 0;
  const bytes = modelBytes(async (path) => {
    self.postMessage({ progress: `Downloading voice model: ${path}` });
    const r = await fetchModel(path);
    got++;
    return r;
  });
  const OWN = /^voices\/(af_heart|am_michael|bf_emma|ff_siwis|jf_alpha|jm_kumo|zf_xiaoxiao)\.bin$/;
  const MORE = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/";
  const E = new Engine(ort, async (file) => {
    if (file.startsWith("voices/") && !OWN.test(file)) {
      const r = await fetch(MORE + file);
      if (!r.ok) throw new Error(`voice ${file}: ${r.status}`);
      return await r.arrayBuffer();
    }
    const b = await bytes(file);
    return file.endsWith(".bin") ? b.buffer : b;
  });
  await E.init({ suffix: W16, executionProviders: gpu ? ["webgpu", "wasm"] : ["wasm"] });
  self.postMessage({ progress: "Warming up the voice..." });
  await E.synth("ja /a \u2198/");
  return E;
}
var engine = start();
engine.catch((e) => self.postMessage({ fatal: String(e && e.message || e) }));
self.onmessage = async ({ data: { id, ys, voice } }) => {
  try {
    const E = await engine;
    if (ys == null) {
      self.postMessage({ id, threads, gpu });
      return;
    }
    const t0 = performance.now();
    const P = plan(ys), outs = [];
    for (const s of P) {
      if (voice && /^ja/.test(s.lang)) s.voice = voice;
      outs.push((await E.synthSection(s, "values")).audio);
    }
    const audio = outs.length === 1 ? outs[0] : join(outs);
    self.postMessage({ id, blob: new Blob([wav(audio)], { type: "audio/wav" }), seconds: audio.length / SR, ms: performance.now() - t0 });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message || e) });
  }
};
