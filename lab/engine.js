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
function splitSections(top, b2, b0) {
  const P = [];
  let pos = 0;
  for (const mm of b2.matchAll(TAG)) {
    const at = mm.index ?? 0;
    P.push([top, pos, b2.slice(pos, at)], [mm[1], at + mm[1].length + 2, mm[2]]);
    pos = at + mm[0].length;
  }
  P.push([top, pos, b2.slice(pos)]);
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
    const kind2 = on ? null : specialMora(s, next(i));
    if (kind2) {
      add({ kind: kind2, ipa: s, end: x.end });
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
  const W2 = [];
  for (let i = 0, s = -1; i <= t.length; i++) {
    const c = t[i];
    if (i === t.length || c === " " || SEP(c)) {
      if (s >= 0) W2.push([s, i]);
      s = -1;
      if (c && SEP(c)) W2.push([i, i + 1]);
    } else if (s < 0) s = i;
  }
  return W2;
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
    const w = t.slice(a, z), b2 = boundary(w, ph, true);
    if (b2) {
      flush();
      out.push(...b2.filter((x) => x.kind !== "bound" || x.sym === "#"));
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
    const b2 = boundary(w, ph);
    if (b2) {
      out.push(...b2);
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
  let raw = "", start = base, f0 = null, end = base;
  const flush = () => {
    if (raw || f0) R.push({ raw, start, end, f0 });
    raw = "";
    f0 = null;
  };
  for (let i = 0; i <= w.length; ) {
    if (i === w.length || w[i] === ".") {
      flush();
      start = base + i + 1;
      end = start;
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
      start = end = base + i;
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

// node_modules/@yomiscript/core/dist/ja_contour.js
var W = {
  H: [0.9002, 0.6245, 0.3215, 1.3808, 1.0254, 0.5983, 0.565, 1.7001, 1.8248, -1.05, -1.5881, -0.8964, -0.3759, -0.5026, -0.9493],
  H_bgx: [0.7035, 1.3411, 1.2794, -1.1374, 0.0261, 0.8996, -1.254, -1.3526, -1.0862, -0.5962, -0.5955, -1.0037, -0.845, -0.8275, -0.4163],
  bg_i: [-0.1178, -0.0998, -0.0798, -0.2072, -0.1907, -0.1408, -0.2166, -0.2405, -0.241, -0.2701, -0.2669, -0.188, 0.985, 0.9193, 0.7848],
  bgx: [4.2458, 3.7873, 2.8561, -1.6189, -2.7211, -1.2077, -0.2683, 1.1098, 2.1054, -1.8795, -2.6873, -5.2917, 0.1992, 98e-4, 1.3627],
  bgx2: [-4.4474, -5.2164, -4.7622, -0.0694, 0.8544, 0.7853, -0.0263, -0.0486, -2.1205, -1.1349, -2.3836, -0.3259, 1.3054, 2.1072, 1.0512],
  down: [0.6604, 0.681, 0.683, 0.0854, 0.1896, 0.2217, -0.9145, -0.9049, -0.8523, -0.0844, -0.141, -0.1573, 0.1517, 0.1302, 0.1516],
  down2: [0.033, -0.0123, -0.0685, -0.0616, -0.0556, -0.1665, 0.2633, 0.1512, 0.2007, -0.0371, 0.1788, 0.2903, -0.2586, -0.2752, -0.3206],
  down_H: [0.0853, 0.0532, 0.0866, -0.0248, -0.0218, -0.0521, -0.183, -0.1396, -0.0864, -0.0395, -0.0728, -0.133, 0.098, 0.054, 0.0153],
  end1: [-1.2792, -1.2966, -0.8737, -0.1654, -0.7334, -1.4384, 0.9391, 0.8616, -15e-4, -0.6398, -0.4224, -0.9231, -0.6443, -0.4942, -0.5097],
  end2: [-1.412, -0.2462, 0.3939, -3.8816, -5.2515, -4.1065, 1.8325, 1.5753, 2.519, 1.0552, 0.4738, 0.4102, -0.0233, -0.1786, -0.3303],
  fL_first: [0.1653, 0.0453, 0.068, 0.4563, 0.3948, 0.4495, 0.8631, 0.7041, 0.4589, 1.0385, 1.0142, 1.6106, 0.5297, 0.9794, 1.0718],
  final: [0, 0, 0, 0, 0, 0, 0.742, 0.7824, 0.4615, -0.7703, -0.063, -0.6452, -0.617, -0.6344, -0.6791],
  final2: [0, 0, 0, 0.742, 0.7824, 0.4615, -0.7703, -0.063, -0.6452, -0.617, -0.6344, -0.6791, -0.2414, -0.3559, -0.3271],
  final_flat: [0, 0, 0, 0, 0, 0, -0.4009, -1.3712, -1.3618, 0.3137, 0.041, -36e-4, 0.2201, 0.3918, 0.5048],
  first_H: [-0.1853, -0.1971, -0.2049, -0.1373, -0.4881, -0.5385, -0.665, -0.3334, 0.1081, -0.3786, -0.2675, -0.4049, -0.3928, -0.4003, -0.2335],
  first_L: [0.945, 1.1908, 0.96, -0.5028, -0.1685, 0.2206, -1.4596, -0.6267, -0.2274, -1.1982, -1.5764, -1.5376, -0.5159, -0.7742, -0.8003],
  first_phrase: [0.0127, -0.0709, -0.0488, 0.2931, 0.3346, 0.3044, 0.1126, 0.2132, 0.1748, -0.0805, -0.0214, 0.0894, -0.2158, -0.2546, -0.1815],
  flat: [-0.0741, 0.0203, 0.1424, -0.0759, -0.0241, -0.1504, 0.0957, -0.0299, 0.0426, 0.1092, 0.1729, 0.1599, -0.3294, -0.4087, -0.4863],
  hpos: [-0.1237, -0.1573, -0.1597, 0.0137, -0.0102, -59e-4, 0.1425, 0.1649, 0.1253, 0.0167, 0.061, 0.0962, 0.0248, 0.0108, 0.0143],
  last_bg: [0.5075, 0.4125, 0.3348, -0.3829, -0.0557, 0.2068, -0.7729, -0.8791, -0.9558, 0.1922, 0.0249, -0.0968, 0.0231, 0.0844, 0.1193],
  lpos: [0.1547, 0.1469, 0.1278, 0.0284, -0.0266, -0.0695, -0.3351, -0.0345, -0.0278, -0.3222, -0.4992, -0.3907, 0.2829, 0.1935, -0.0493],
  nucm: [-0.0136, -0.0876, -0.1316, 0.5455, -0.0205, -0.2689, 0.3811, 0.5184, 0.4849, 0.6471, 0.6156, 0.413, 0.879, 1.1209, 1.4015],
  nucm_bgx: [-2.9568, -2.9602, -2.3205, -1.5384, -2.6502, -3.0136, 1.4722, 0.9811, -0.345, 0.8307, 0.7888, 1.5857, -0.3531, -0.6366, -0.9942],
  phrase_last: [0.6379, 1.4142, 1.3112, -0.8891, -0.3409, 0.0838, -0.7195, -0.9274, -1.011, -0.6154, -0.6281, -0.7299, -0.0794, -0.1831, -0.2949],
  pib: [-0.2117, 0.0299, -0.2356, -0.3793, -0.4637, -0.0739, 0.52, 0.4323, 0.6576, 1.062, 0.8634, 0.4344, 1.2675, 1.3258, 1.344],
  post: [-0.4051, -0.0661, 0.0991, -1.2025, -1.1509, -0.8386, -0.1415, -2.0912, -2.4033, 1.9281, 2.8822, 1.899, 0.4473, 0.6637, 1.7055],
  post1: [-0.2523, -0.0196, 0.0216, -0.0136, -0.0876, -0.1316, 0.5455, -0.0205, -0.2689, 0.3811, 0.5184, 0.4849, 0.6471, 0.6156, 0.413],
  post_bgx: [0.2751, 0.0445, -0.0376, 1.8007, 2.7418, 2.2926, -0.81, 0.915, 1.9724, -1.5385, -2.215, -1.8492, -1.9673, -1.8981, -2.0898],
  prepause: [-1.2792, -1.2966, -0.8737, -0.1654, -0.7334, -1.4384, 1.034, 0.8612, -0.3998, -0.4765, -0.6985, -1.0892, -0.6168, -0.3327, -0.3217],
  q: [1.1407, 0.0176, -0.408, 1.6861, 1.3924, 1.0494, -0.6256, 0.9076, 3.459, -0.5544, -0.4817, -0.3009, -0.1924, -0.0997, 0.102],
  q2: [1.6861, 1.3924, 1.0494, -0.6256, 0.9076, 3.459, -0.5544, -0.4817, -0.3009, -0.1924, -0.0997, 0.102, -0.4276, -0.5058, -0.2732],
  q_H: [-2.7032, -3.3992, -4.0897, -3.2517, -4.1292, -5.0719, 4.3189, 3.2602, 1.1747, 3.8848, 3.5671, 3.4362, 3.0486, 2.8146, 2.9606],
  size: [-0.0719, -0.0615, -0.0163, 0.148, 0.1233, 0.0278, 0.0116, 82e-4, 0.1003, 0.0914, 0.094, 0.0257, -0.1798, -0.1638, -0.1474],
  size_s: [1.0275, 1.3039, 0.8172, -1.3415, -1.1954, -0.3495, -0.2296, -0.412, -0.9877, -0.5874, -0.6417, -0.1048, 1.0772, 1.0228, 0.8462],
  sx: [-9.5757, -8.8481, -8.9357, 2.1646, 2.0521, 1.9042, 5.0785, 4.4843, 4.9879, 2.3678, 1.1175, 1.9047, -1.3746, -0.359, -1.2773],
  to_end: [-0.6638, -1.6697, -1.6024, 0.7618, 1.4441, 0.8868, 0.915, 1.0043, 1.1744, -0.3403, -0.64, -0.5584, -0.6821, -0.4327, -0.3046],
  v_N: [0.2137, 0.1937, 0.1708, 0.5322, 0.3068, 0.0298, 0.8715, 0.6635, 0.6917, -0.1751, 0.2909, 0.9904, -0.0756, -0.1468, -0.2913],
  v_Q: [0.7782, 0.7814, 0.6954, 0.2751, 0.4095, 0.5268, -0.2791, -0.1259, 0.7242, -0.0587, -0.1029, -0.3758, 0.3047, 0.2125, 0.1389],
  v_R: [0.2472, 0.2655, 0.2049, 0.2652, 0.1909, 0.0837, 0.4369, 0.4015, 0.3504, 0.0717, 0.107, 0.522, 0.0951, -0.0175, -0.0529],
  v_a: [0.3896, 0.4734, 0.3894, -0.0557, -0.05, 11e-4, -0.2725, -0.4061, -0.2823, -0.1752, -0.2214, -0.2276, -0.0928, -0.1298, -0.0804],
  v_e: [0.2605, 0.3522, 0.2774, -0.052, -0.092, -0.0942, 0.0582, -0.0963, -0.2382, -0.0165, -0.0492, -0.1643, -0.0568, -0.0339, 0.0542],
  v_i: [0.3918, 0.4401, 0.3216, 0.2752, 0.1394, 0.1243, 0.061, 0.2132, 0.1623, 0.0109, 0.0293, 0.047, 0.0162, -0.0253, 0.0306],
  v_o: [0.2724, 0.2843, 0.1642, -0.0154, -0.0322, -0.0145, -0.058, -0.108, -0.2545, 0.0749, -41e-4, -0.0806, 0.1135, 0.104, 0.1997],
  v_u: [0.2996, 0.3514, 0.206, 0.2983, 0.1821, 0.0904, -0.1201, 0.2092, 0.2118, 2e-4, -0.0235, -0.2074, -0.0418, -0.0817, -0.0408],
  vl: [-0.0228, -0.0625, -0.0547, 0.1263, 0.0789, 0.0544, 1.1619, 0.4086, 0.311, -0.0161, 0.1576, 0.1844, 0.0384, 0.0778, 0.1331]
};
var POINT = [1.0902, 1.4534, 1.0078];
var JA_CONTOUR = { POINT, W };
var CTX = 2;
var VOICELESS = /* @__PURE__ */ new Set(["k", "k\u02B2", "s", "\u0255", "t", "t\u0255", "ts", "h", "\xE7", "\u0278", "p", "p\u02B2"]);
var VOWEL = { a: "a", i: "i", \u026F: "u", e: "e", o: "o" };
var size = (s) => s.phrases.reduce((n, p) => n + p.morae.length, 0);
function sentences(sec) {
  const out = [{ phrases: [], qs: /* @__PURE__ */ new Set() }];
  let pause = false, chunk = -1;
  for (const t of sec.toks) {
    const cur = out[out.length - 1];
    if (t.kind === "unit") {
      if (t.chunk !== chunk || !cur.phrases.length)
        cur.phrases.push({ morae: [], pause });
      cur.phrases[cur.phrases.length - 1].morae.push(t);
      chunk = t.chunk ?? 0;
      pause = false;
    } else if (t.kind === "pause")
      pause = true;
    else if (t.kind === "punct" && t.sent && t.sym === "?") {
      cur.qs.add(size(cur) - 1);
      pause = true;
    } else if (t.kind === "punct" && t.sent) {
      out.push({ phrases: [], qs: /* @__PURE__ */ new Set() });
      pause = false;
    }
  }
  if (sec.end === "?")
    out[out.length - 1].qs.add(size(out[out.length - 1]) - 1);
  return out.filter((s) => s.phrases.length);
}
var b = (x) => x ? 1 : 0;
function phraseRows(M, at) {
  const n = M.length, f = M.findIndex((m) => m.fall), nuc = f < 0 ? 0 : f + 1;
  let high = !M[0].hasRise, hk = 0;
  return M.map((m, j) => {
    const H = high ? 1 : 0, i = at.i + j;
    const r = {
      ...{ H, first_L: b(j === 0 && !high), hpos: H * hk, nucm: b(nuc > 0 && j === nuc - 1), post1: b(nuc > 0 && j === nuc) },
      ...{ post: b(nuc > 0 && j > nuc), lpos: nuc > 0 && j >= nuc ? j - nuc : 0, flat: b(nuc === 0 || nuc === n) },
      ...{ down: at.acc, down_H: at.acc * H, bgx: (i - at.bgS) / Math.max(at.bgE - at.bgS, 1), sx: i / at.total, bg_i: at.bgI },
      ...{ last_bg: b(at.bgE === at.total), final: b(i === at.total - 1), final2: b(i === at.total - 2) },
      ...{ prepause: b(at.pauses.has(i + 1)), q: b(at.qs.has(i)), q2: b(at.qs.has(i + 1)), phrase_last: b(j === n - 1) },
      ...{ size: n, first_phrase: b(at.first), size_s: Math.min(n, 8) / 8, first_H: H * b(j === 0), pib: Math.min(at.pib, 4) / 4 }
    };
    if (high)
      hk++;
    if (m.rise)
      high = true;
    if (m.fall)
      high = false;
    return { ...r, ...combined(r, at.bgE - i) };
  });
}
function combined(r, toEnd) {
  return {
    ...{ to_end: Math.min(toEnd, 8) / 8, end1: b(toEnd === 1), end2: b(toEnd === 2), bgx2: r.bgx ** 2, down2: b(r.down >= 2) },
    ...{ H_bgx: r.H * r.bgx, post_bgx: (r.post + r.post1) * r.bgx, fL_first: r.first_L * r.first_phrase, final_flat: r.final * r.flat },
    ...{ q_H: r.q * r.H, nucm_bgx: r.nucm * r.bgx }
  };
}
function kind(m, prev) {
  if (m.mk === "N" || m.mk === "Q")
    return m.mk;
  if (m.mk === "R" || !m.on && m.v === prev)
    return "R";
  return VOWEL[m.v ?? ""] ?? "a";
}
function moraRows(morae) {
  let prev;
  return morae.map((m) => {
    const v = kind(m, prev);
    if (v === "N" || v === "Q")
      prev = void 0;
    else if (v !== "R")
      prev = m.v;
    const r = { vl: b(VOICELESS.has(m.on ?? "")) };
    for (const k of ["a", "i", "u", "e", "o", "N", "Q", "R"])
      r["v_" + k] = b(v === k);
    return r;
  });
}
function sentenceRows(s) {
  const total = size(s), pauses = /* @__PURE__ */ new Set(), rows = [];
  let k = 0;
  for (const p of s.phrases) {
    if (p.pause)
      pauses.add(k);
    k += p.morae.length;
  }
  const bounds = [0, ...pauses, total].sort((x, y) => x - y);
  let acc = 0, bgI = 0, pib = 0;
  k = 0;
  s.phrases.forEach((p, pi) => {
    if (p.pause)
      [acc, bgI, pib] = [0, bgI + 1, 0];
    const bgS = Math.max(...bounds.filter((x) => x <= k)), bgE = Math.min(...bounds.filter((x) => x > k));
    rows.push(...phraseRows(p.morae, { i: k, total, bgS, bgE, bgI, acc, pib, first: pi === 0 || p.pause, pauses, qs: s.qs }));
    if (p.morae.some((m) => m.fall))
      acc++;
    k += p.morae.length;
    pib++;
  });
  const what = moraRows(s.phrases.flatMap((p) => p.morae));
  return rows.map((r, i) => ({ ...r, ...what[i] }));
}
function values(rows, model) {
  return rows.map((_, i) => {
    const v = [...model.POINT];
    for (let d = -CTX; d <= CTX; d++) {
      const r = rows[i + d];
      if (!r)
        continue;
      for (const [f, x] of Object.entries(r))
        for (let p = 0; p < 3; p++)
          v[p] += x * model.W[f][(d + CTX) * 3 + p];
    }
    return v;
  });
}
function median(a) {
  const s = [...a].sort((x, y) => x - y), h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
function jaContour(sec, model = JA_CONTOUR) {
  const out = /* @__PURE__ */ new Map();
  for (const s of sentences(sec)) {
    const V2 = values(sentenceRows(s), model);
    const mid = median(V2.flat());
    s.phrases.flatMap((p) => p.morae).forEach((m, i) => out.set(m, V2[i].map((v) => v - mid)));
  }
  return out;
}

// node_modules/@yomiscript/core/dist/yomite.js
var inStr2 = (ch, s) => s.includes(ch);
var fmt = (v) => String(Math.round(v * 100) / 100);
var f0Mark = (c) => `<f0:${c.map(fmt).join(",")}>`;
function applyEdits(s, E) {
  for (const e of [...E].sort((a, b2) => b2.at - a.at))
    s = s.slice(0, e.at) + e.ins + s.slice(e.at + (e.del || 0));
  return s;
}
var VLJ = ["k", "s", "\u0255", "t", "\u02A8", "\u02A6", "h", "\xE7", "\u0278", "p"];
var voicelessStart = (m) => !!m && m.mk === "mora" && VLJ.some((x) => (m.ipa ?? "").startsWith(x));
function devoiced(M, k, end) {
  const m = M[k];
  if (m.mk !== "mora" || !inStr2(m.v ?? "", "i\u026F\u0268") || !voicelessStart(m))
    return false;
  if (voicelessStart(M[k + 1]))
    return true;
  return k === M.length - 1 && end === "$" && (m.ipa === "s\u026F" || m.ipa === "s\u0268");
}
function osakaValue(high, k, hk) {
  if (!high)
    return k === 0 ? -2 : -2.5 - 0.3 * hk;
  const v = 2.5 - 0.45 * hk;
  return v >= 0 ? 2.5 - (2.5 - v) / 3 : v;
}
function levelOnset(M, contour) {
  const f = M.findIndex((m) => m.fall), S = M.slice(0, f < 0 ? M.length : f + 1), out = new Map(contour);
  let top = -Infinity;
  for (let k = S.length - 1; k >= 0; k--) {
    const c = [...contour.get(S[k]) ?? []];
    for (let i = c.length - 1; i >= 0; i--)
      c[i] = top = Math.max(top, c[i]);
    out.set(S[k], c);
  }
  return out;
}
function jaPhrase(M, end, E, { devoice, scale, flatOnset, contour: C }) {
  let high = !M[0].hasRise, hk = 0;
  const contour = C && flatOnset && high && !M[0].fall ? levelOnset(M, C) : C;
  M.forEach((m, k) => {
    const c = contour ? contour.get(m) : !m.dev && [osakaValue(high, k, hk)];
    if (c && !m.f0)
      E.push({ at: m.end ?? 0, ins: f0Mark(c.map((v) => v * scale)) });
    if (devoice && contour && devoiced(M, k, end) && !m.dev)
      E.push({ at: m.vend ?? 0, ins: "\u0325" });
    if (high)
      hk++;
    if (m.rise)
      high = true;
    if (m.fall)
      high = false;
  });
}
var marked = (M) => M.some((m) => m.rise || m.fall);
function jaRules(sec, E, opt) {
  const C = [];
  for (const t of sec.toks) {
    if (t.kind !== "unit")
      continue;
    const c = t.chunk ?? 0;
    C[c] ??= [];
    C[c].push(t);
  }
  const o = {
    devoice: opt.devoice ?? !opt.markedOnly,
    scale: opt.jaScale ?? 1,
    flatOnset: !!opt.flatOnset,
    contour: opt.dialect?.ja === "osaka" ? null : jaContour(sec, opt.jaModel)
  };
  for (const M of C)
    if (!opt.markedOnly || marked(M))
      jaPhrase(M, sec.end, E, o);
}
function flaps(t, prev) {
  const r = t.raw ?? "";
  if (t.j === 0 || !inStr2(r[0] ?? "#", "td") || r.length < 2 || prev?.kind !== "unit")
    return false;
  if (!inStr2(r[1], VOWELS + "\u025D\u025A") && !r.slice(1).startsWith("l\u0329"))
    return false;
  return inStr2((prev.raw ?? "").slice(-1), VOWELS + "\u0279r\u025D\u025A");
}
function euValue(t, fr) {
  if (fr)
    return t.j === (t.nsyl ?? 0) - 1 ? [0.5] : [-0.5];
  return { "\u02C8": [3, 1], "\u02CC": [1] }[t.st ?? ""] ?? [-1.5];
}
var flapping = (lang, top) => lang.startsWith("en") && lang !== "en-GB" && top.startsWith("en");
var lastValued = (C) => C.findLast((x) => x.c);
function euContours(sec, top, E) {
  const fr = sec.lang === "fr", flap = flapping(sec.lang, top);
  const C = [];
  let prev = null;
  for (const t of sec.toks) {
    const L = t.kind === "bound" ? lastValued(C) : null;
    if (L?.c)
      L.c = [...L.c, 2.5];
    if (t.kind === "bound")
      continue;
    if (t.kind === "unit" && flap && !t.f0 && flaps(t, prev))
      E.push({ at: t.start ?? 0, del: 1, ins: "\u027E" });
    if (t.kind === "unit")
      C.push({ t, c: t.f0 ? null : euValue(t, fr) });
    prev = t;
  }
  return C;
}
function euRules(sec, E, top) {
  const C = euContours(sec, top, E), L = lastValued(C);
  if (L?.c)
    L.c = [L.c[0], sec.end === "$" ? -5 : 6];
  for (const { t, c } of C)
    if (c)
      E.push({ at: t.end ?? 0, ins: f0Mark(c) });
}
var TC = { 1: [3, 3], 2: [-1, 3.5], 3: [-3, -4.5, -3], 4: [4, -3], 5: null };
function zhRules(sec, E) {
  for (const t of sec.toks) {
    const c = TC[t.tone ?? ""];
    if (t.kind === "unit" && !t.f0 && c)
      E.push({ at: t.end ?? 0, ins: f0Mark(c) });
  }
}
function realize(ys, opt = {}) {
  const Y = parse(ys), E = [];
  for (const sec of Y.sections) {
    if (isJa(sec.lang))
      jaRules(sec, E, opt);
    else if (opt.markedOnly)
      continue;
    else if (sec.lang === "zh")
      zhRules(sec, E);
    else
      euRules(sec, E, Y.top);
  }
  return applyEdits(Y.ys, E);
}

// node_modules/@yomiscript/ja-accent/dist/marks.js
var ONSET = {
  k: "k",
  ky: "k\u02B2",
  g: "\u0261",
  gy: "\u0261\u02B2",
  s: "s",
  sh: "\u0255",
  z: "dz",
  j: "d\u0291",
  t: "t",
  ty: "t\u02B2",
  ch: "t\u0255",
  ts: "ts",
  d: "d",
  dy: "d\u02B2",
  n: "n",
  ny: "\u0272",
  h: "h",
  hy: "\xE7",
  f: "\u0278",
  b: "b",
  by: "b\u02B2",
  p: "p",
  py: "p\u02B2",
  m: "m",
  my: "m\u02B2",
  r: "\u027E",
  ry: "\u027E\u02B2",
  y: "j",
  w: "w",
  v: "v"
};
function moraKey(onset, vowel) {
  const v = vowel.toLowerCase().replace(/[uɨ]/g, "\u026F"), o = onset.replace(/g/g, "\u0261").replace(/^([kɡbpmɾtd])j$/, "$1\u02B2").replace(/^v/, "b").replace(/^z/, "dz").replace(/^ʑ/, "d\u0291").replace(/^h[ʲj]$/, "\xE7").replace(/^n[ʲj]$/, "\u0272");
  if (v === "i" && o === "h")
    return "\xE7i";
  if (v === "i" && o === "n")
    return "\u0272i";
  return o + v;
}
function dictKey(m, prevVowel) {
  const [a, b2] = m.ph;
  if (a === "N")
    return "N";
  if (a === "cl")
    return "Q";
  if (b2 === void 0)
    return a.toLowerCase() === prevVowel ? "R" : moraKey("", a);
  return moraKey(ONSET[a] ?? a, b2);
}
function unitKey(t) {
  if (t.mk === "N")
    return "N";
  if (t.mk === "Q")
    return "Q";
  if (t.mk === "R")
    return "R";
  return moraKey(t.on ?? "", t.v ?? "");
}
function sameMorae(M, U) {
  if (M.length !== U.length)
    return false;
  let prev = "";
  return M.every((m, i) => {
    const k = dictKey(m, prev), u = unitKey(U[i]);
    if (k !== "R" && k !== "N" && k !== "Q")
      prev = k.slice(-1);
    return k === u || k === "R" && u === prev || u === "R" && k === prev;
  });
}
function words2(u, ys) {
  const W2 = [];
  let at = 0;
  for (const t of u.texts) {
    W2.push({ start: at, end: at + t.length, units: [], from: -1, close: -1 });
    at += t.length;
  }
  for (const sec of u.sections)
    for (const t of sec.toks)
      if (t.kind === "unit" && t.lang === "ja" && t.span !== void 0)
        W2[t.span].units.push(t);
  for (const w of W2) {
    if (!w.units.length)
      continue;
    const first = (w.units[0].end ?? 0) - 1, last = w.units[w.units.length - 1].end ?? 0;
    w.from = Math.max(ys.lastIndexOf(" ", first), ys.lastIndexOf("/", first)) + 1;
    w.close = ys.indexOf(">", last) + 1;
  }
  return W2;
}
var TRAILING = /^[\s、。，．,.!?！？「」『』()（）・…〜~]*$/;
var LEADING = /^[\p{Ps}\p{Pi}]*$/u;
function cover(W2, p, text) {
  const a = W2.findIndex((w) => w.start <= p.start && w.end > p.start && LEADING.test(text.slice(w.start, p.start)));
  if (a < 0)
    return null;
  let z = a;
  while (z < W2.length && W2[z].end < p.end)
    z++;
  if (z >= W2.length || !TRAILING.test(text.slice(p.end, W2[z].end)))
    return null;
  return W2.slice(a, z + 1);
}
function phraseEdits(p, C, U) {
  const E = [
    { at: C[0].from, ins: "| " },
    { at: C[C.length - 1].close, ins: " |" }
  ];
  for (let i = 0; i + 1 < U.length; i++) {
    const [a, b2] = [p.morae[i].hl, p.morae[i + 1].hl];
    if (a !== b2)
      E.push({ at: U[i].end ?? 0, ins: a === "L" ? "\uA71B" : "\uA71C" });
  }
  return E;
}
function dictKeys(M) {
  let prev = "";
  return M.map((m) => {
    const k = dictKey(m, prev);
    if (k !== "R" && k !== "N" && k !== "Q")
      prev = k.slice(-1);
    return k;
  });
}
function onePipe(ys) {
  let out = ys;
  while (out.includes("| |"))
    out = out.replaceAll("| |", "|");
  return out;
}
function writeMarks(ys, P) {
  const u = parse(ys), text = u.texts.join(""), W2 = words2(u, ys), stats2 = { phrases: P.length, marked: 0, reading: 0, words: 0, misses: [] }, E = [];
  for (const p of P) {
    const C = cover(W2, p, text), U = C?.flatMap((w) => w.units) ?? [];
    if (!C || !U.length)
      stats2.words++;
    else if (!sameMorae(p.morae, U)) {
      stats2.reading++;
      stats2.misses.push({ text: text.slice(p.start, p.end), dict: dictKeys(p.morae), ys: U.map(unitKey) });
    } else {
      stats2.marked++;
      E.push(...phraseEdits(p, C, U));
    }
  }
  const out = applyEdits(ys, E).replace(/\/\| /g, "/").replace(/ \| (?=[‖↘↗/|])/g, " ").replace(/([‖↘↗]) \| /g, "$1 ").replace(/([‖↘↗]<t:[^>]*>) \| /g, "$1 ").replace(/ {2,}/g, " ");
  return { ys: onePipe(out), stats: stats2 };
}

// node_modules/@yomiscript/ja-accent/dist/lookup.js
var FALLBACK = 1e6;
function wordsOf(u) {
  const W2 = u.texts.map((t) => ({ text: t, units: [] }));
  for (const sec of u.sections)
    for (const t of sec.toks)
      if (t.kind === "unit" && isJa(sec.lang) && t.span !== void 0)
        W2[t.span].units.push(t);
  return W2;
}
var OPENING = /^[\p{Ps}\p{Pi}]+/u;
function apart(W2) {
  const out = [], at = [];
  for (const w of W2) {
    const quote = w.units.length ? w.text.match(OPENING)?.[0] : void 0;
    if (quote && quote !== w.text)
      out.push({ text: quote, units: [] });
    at.push(out.length);
    out.push(quote && quote !== w.text ? { ...w, text: w.text.slice(quote.length) } : w);
  }
  return { W: out, at };
}
function asMorae(ph, prev) {
  const out = [];
  let v = prev;
  for (const p of ph) {
    const m = p[0] === "-" ? [v ?? "-"] : p;
    out.push({ ph: m, hl: "L", phrase: 0 });
    const last = m[m.length - 1];
    if (/^[aiueoAIUEO]$/.test(last))
      v = last.toLowerCase();
  }
  return out;
}
function layout(S, W2) {
  const U = [], M = [0], wordOf = [];
  W2.forEach((w, i) => {
    U.push(...w.units);
    M.push(U.length);
    for (let c = S.starts[i]; c < S.starts[i + 1]; c++)
      wordOf.push(i);
  });
  return { U, M, wordOf, free: W2.map((w) => w.units.length === 0) };
}
function fits(S, Y, i, m) {
  const c = S.cands[i], w0 = Y.wordOf[c.s], w1 = Y.wordOf[c.e - 1];
  let free = 0;
  for (let w = w0; w <= w1; w++)
    free += Y.free[w] ? 1 : 0;
  if (free)
    return free === w1 - w0 + 1 ? 0 : -1;
  const prev = m > 0 ? Y.U[m - 1].v?.replace(/[ɯɨ]/g, "u") : void 0, K = asMorae(c.ph, prev), end = m + K.length;
  if (end > Y.M[w1 + 1] || !sameMorae(K, Y.U.slice(m, end)))
    return -1;
  const atStart = S.starts.indexOf(c.e);
  return atStart >= 0 && Y.M[atStart] !== end ? -1 : K.length;
}
function fallbacks(S, W2) {
  const out = /* @__PURE__ */ new Map();
  W2.forEach((_, i) => {
    const [a, z] = [S.starts[i], S.starts[i + 1]], I = S.alone.filter((k) => S.cands[k].s >= a && S.cands[k].e <= z);
    if (I.length && S.cands[I[0]].s === a && S.cands[I[I.length - 1]].e === z)
      out.set(a, [...out.get(a) ?? [], { word: i, path: I }]);
  });
  return out;
}
var Lattice = class {
  at;
  costs = /* @__PURE__ */ new Map();
  a;
  constructor(n, a) {
    this.at = Array.from({ length: n + 1 }, () => /* @__PURE__ */ new Map());
    this.a = a;
  }
  put(c, node) {
    const k = `${node.m}|${node.r}`, old = this.at[c].get(k);
    if (!old || node.cost < old.cost)
      this.at[c].set(k, node);
  }
  cost(r, l) {
    const k = r * 65536 + l;
    let v = this.costs.get(k);
    if (v === void 0) {
      v = this.a.conn(r, l);
      this.costs.set(k, v);
    }
    return v;
  }
};
function step({ S, Y, X, from, fb, chars }, c, node) {
  for (const i of from.get(c) ?? []) {
    const k = fits(S, Y, i, node.m), x = S.cands[i], r = OPENING.test(chars[x.s]) ? 0 : x.r;
    if (k >= 0)
      X.put(x.e, { m: node.m + k, r, cost: node.cost + X.cost(node.r, x.l) + x.cost, prev: node, path: [i], fell: -1 });
  }
  for (const f of fb.get(c) ?? []) {
    if (node.m !== Y.M[f.word] || Y.free[f.word])
      continue;
    const P = f.path.map((i) => S.cands[i]);
    let inner = X.cost(node.r, P[0].l) + P[0].cost;
    for (let j = 1; j < P.length; j++)
      inner += X.cost(P[j - 1].r, P[j].l) + P[j].cost;
    X.put(S.starts[f.word + 1], { m: Y.M[f.word + 1], r: P[P.length - 1].r, cost: node.cost + inner + FALLBACK, prev: node, path: f.path, fell: f.word });
  }
}
function backtrack(X, end, morae) {
  let best = null;
  for (const node of end.values()) {
    const total = node.cost + X.cost(node.r, 0);
    if (node.m === morae && (!best || total < best.total))
      best = { node, total };
  }
  if (!best)
    return null;
  const path = [], fell = [];
  for (let node = best.node; node; node = node.prev) {
    path.unshift(...node.path);
    if (node.fell >= 0)
      fell.unshift(node.fell);
  }
  return { path, fell };
}
function bestPath(S, W2, a) {
  const Y = layout(S, W2), n = S.starts[S.starts.length - 1], X = new Lattice(n, a), from = /* @__PURE__ */ new Map(), chars = [...S.norm];
  S.cands.forEach((c, i) => from.set(c.s, [...from.get(c.s) ?? [], i]));
  X.put(0, { m: 0, r: 0, cost: 0, prev: null, path: [], fell: -1 });
  const G = { S, Y, X, from, fb: fallbacks(S, W2), chars };
  for (let c = 0; c < n; c++)
    for (const node of X.at[c].values()) {
      if (/\s/.test(chars[c]))
        X.put(c + 1, { ...node, prev: node, path: [], fell: -1 });
      step(G, c, node);
    }
  return backtrack(X, X.at[n], Y.U.length);
}
function ownPhrases(u, W2, at, S) {
  const ja = u.sections.filter((sec) => isJa(sec.lang) && sec.toks.some((t) => t.kind === "bound" && t.sym === "#"));
  if (!ja.length)
    return null;
  const starts = /* @__PURE__ */ new Set(), own = /* @__PURE__ */ new Set();
  for (const sec of ja) {
    let ph = -1;
    for (const t of sec.toks)
      if (t.kind === "unit" && t.span !== void 0) {
        own.add(at[t.span]);
        if (t.ph !== ph && W2[at[t.span]].units[0] === t)
          starts.add(at[t.span]);
        ph = t.ph ?? ph;
      }
  }
  const word = new Map(S.starts.slice(0, -1).map((c, i) => [c, i]));
  return (prev, cur) => {
    const i = word.get(cur.s), p = word.get(prev.s);
    if (i === void 0 || !own.has(i) || !W2[i].units.length || p !== void 0 && !W2[p].units.length)
      return void 0;
    return !starts.has(i);
  };
}
var KEEPS_ACCENT = { a: 0, chain: "\u52D5\u8A5E%F1/\u5F62\u5BB9\u8A5E%F1" };
var auxiliaryTeru = (e) => e.pos.startsWith("\u52D5\u8A5E,\u975E\u81EA\u7ACB") && (e.pron === "\u30C6\u30EB" || e.pron === "\u30C7\u30EB") ? KEEPS_ACCENT : void 0;
var isTe = (e) => !!e && /^(?:て|で|てる|でる)$/.test(e.surface) && /^(?:助詞,接続助詞|動詞,非自立)/.test(e.pos);
var BASE_ENDINGS = { \u3063: ["\u3046", "\u3064", "\u308B"], \u3093: ["\u306C", "\u3076", "\u3080"], \u3044: ["\u304F", "\u3050"], \u3057: ["\u3059"] };
function baseFall(stem, a) {
  const kana = stem.pron.replaceAll("\u2019", ""), root = stem.surface.slice(0, -1), bases = [`${stem.surface}\u308B`, ...(BASE_ENDINGS[stem.surface.slice(-1)] ?? []).map((end) => root + end)];
  const found = bases.flatMap((b2) => {
    const n = [...b2].length;
    return a.candidates([b2]).cands.filter((c) => c.s === 0 && c.e === n && c.pos.startsWith("\u52D5\u8A5E,\u81EA\u7ACB")).filter((c) => {
      const base = c.pron.replaceAll("\u2019", "");
      return kana.length > 1 ? base.startsWith(kana.slice(0, -1)) : base === `${kana}\u30EB`;
    });
  });
  const fall = found[0]?.acc;
  if (fall === void 0 || !found.every((c) => c.acc === fall))
    return void 0;
  if (fall <= 1)
    return fall;
  return ichidanFall(stem, kana, bases[0], found);
}
function ichidanFall(stem, kana, base, found) {
  const n = [...base].length, c = found[0], isIchidan = found.every((x) => x.e === n && x.pron.replaceAll("\u2019", "") === `${kana}\u30EB`) && base === `${stem.surface}\u308B`;
  if (!isIchidan || c.acc !== c.ph.length - 1)
    return void 0;
  let fall = c.acc - 1;
  while (fall > 1 && ["N", "cl", "-"].includes(c.ph[fall - 1][0]))
    fall--;
  return fall;
}
function beforeTe(e, next, a) {
  if (!e.pos.startsWith("\u52D5\u8A5E,\u81EA\u7ACB") || !isTe(next))
    return void 0;
  const fall = baseFall(e, a);
  return fall !== void 0 && fall !== e.acc ? { a: fall } : void 0;
}
var isOneKanjiNoun = (e) => !!e && e.pos.startsWith("\u540D\u8A5E") && /^\p{Script=Han}$/u.test(e.surface);
var isThisOrOur = (e) => !!e && /^[当弊]$/.test(e.surface) && /^(?:トー|トウ|ヘー|ヘイ)$/.test(e.pron.replaceAll("\u2019", ""));
function thisOrOur(E, k) {
  if (isThisOrOur(E[k]) && isOneKanjiNoun(E[k + 1]))
    return { a: 1 };
  if (isThisOrOur(E[k - 1]) && isOneKanjiNoun(E[k]))
    return { a: 0, chain: "C5" };
  return void 0;
}
function lookupAnalysis(u, a, source, join) {
  const { W: W2, at } = apart(wordsOf(u)), words3 = W2.map((w) => w.text), S = a.candidates(words3), best = bestPath(S, W2, a), path = best ? best.path : S.alone, chars = [...S.norm], E = path.map((i) => ({ ...S.cands[i], surface: chars.slice(S.cands[i].s, S.cands[i].e).join("") })), accents = E.map((e, k) => source?.(e) ?? auxiliaryTeru(e) ?? beforeTe(e, E[k + 1], a) ?? thisOrOur(E, k) ?? null), own = ownPhrases(u, W2, at, S), rule = (p, e) => own?.(p, e) ?? join?.(p, e) ?? null, chain2 = (own || join) && E.map((e, k) => k ? rule(E[k - 1], e) : null);
  return { ...a.label(words3, path, accents, chain2), fell: best ? best.fell.map((i) => W2[i].text) : [], found: !!best };
}

// node_modules/@yomiscript/ja-accent/dist/labels.js
function num(rx, s) {
  const m = rx.exec(s);
  return m === null || m[1] === "xx" ? null : Number(m[1]);
}
function tokyo(pos, accent2) {
  if (accent2 === 1)
    return pos === 1 ? "H" : "L";
  if (pos === 1)
    return "L";
  return accent2 === 0 || pos <= accent2 ? "H" : "L";
}
function labelMorae(labels) {
  const out = [], ids = /* @__PURE__ */ new Map();
  let last = null;
  for (const lab of labels) {
    const i = lab.indexOf("-"), p = lab.slice(i + 1, lab.indexOf("+", i));
    if (p === "sil" || p === "pau") {
      last = null;
      continue;
    }
    const pos = num(/\/A:[0-9-]+\+(\d+)\+/, lab) ?? 0, accent2 = num(/\/F:\d+_(\d+)#/, lab) ?? 0;
    const phrase = `${num(/\/I:\d+-\d+@(\d+)\+/, lab)} ${num(/\/F:\d+_\d+#\d+_\w+@(\d+)_/, lab)}`;
    const here = `${phrase}/${pos}`;
    if (here !== last) {
      if (!ids.has(phrase))
        ids.set(phrase, ids.size);
      out.push({ ph: [], hl: tokyo(pos, accent2), phrase: ids.get(phrase) ?? 0 });
      last = here;
    }
    out[out.length - 1].ph.push(p);
  }
  return out;
}

// node_modules/@yomiscript/ja-accent/dist/phrases.js
function njdWords(njd) {
  return njd.map((line) => {
    const f = line.split(","), n = f.length;
    return { string: f.slice(0, n - 12).join(","), mora: Number(f[n - 3].split("/")[1] ?? 0) };
  });
}
var nfkc = (s) => s.normalize("NFKC");
function normalized(text) {
  let norm = "", from = 0;
  const at = [];
  for (const c of text) {
    const n = nfkc(c);
    norm += n;
    for (let j = 0; j < n.length; j++)
      at.push(from);
    from += c.length;
  }
  at.push(text.length);
  return { norm, at };
}
function place(text, words3) {
  const out = [], { norm, at } = normalized(text);
  let cur = 0, pending = [];
  for (const w of words3) {
    const s = nfkc(w.string), i = s ? norm.indexOf(s, cur) : -1;
    if (i < 0 || i > cur && !pending.length && norm.slice(cur, i).trim()) {
      pending.push(out.length);
      out.push([0, 0]);
      continue;
    }
    for (const k of pending)
      out[k] = [at[cur], at[i]];
    pending = [];
    out.push([at[i], at[i + s.length]]);
    cur = i + s.length;
  }
  for (const k of pending)
    out[k] = [at[cur], text.length];
  return out;
}
function separate(P) {
  const bad = /* @__PURE__ */ new Set();
  for (let i = 0; i + 1 < P.length; i++)
    if (P[i].end > P[i + 1].start)
      bad.add(i);
  return P.filter((_, i) => !bad.has(i) && !bad.has(i - 1));
}
function dictPhrases(text, njd, labels) {
  const words3 = njdWords(njd), M = labelMorae(labels);
  if (words3.reduce((a, w) => a + w.mora, 0) !== M.length)
    return null;
  const spans = place(text, words3), out = [];
  let k = 0;
  words3.forEach((w, i) => {
    if (w.mora === 0)
      return;
    const [a, z] = spans[i], id = M[k].phrase;
    if (!out.length || out[out.length - 1].id !== id)
      out.push({ id, start: a, end: z, morae: [] });
    const p = out[out.length - 1];
    p.start = Math.min(p.start, a);
    p.end = Math.max(p.end, z);
    p.morae.push(...M.slice(k, k + w.mora));
    k += w.mora;
  });
  return separate(out.map(({ start, end, morae }) => ({ start, end, morae })));
}

// node_modules/@yomiscript/ja-accent/wasm/pkg/frontend.js
var Frontend = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    FrontendFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_frontend_free(ptr, 0);
  }
  /**
   * `[njd, labels]` as JSON: the NJD features of each word (CSV, as pyopenjtalk's run_frontend prints them) and
   * the full-context label of each phoneme, for the text as OpenJTalk analyses it
   * @param {string} text
   * @returns {string}
   */
  analyze(text) {
    let deferred3_0;
    let deferred3_1;
    try {
      const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.frontend_analyze(this.__wbg_ptr, ptr0, len0);
      var ptr2 = ret[0];
      var len2 = ret[1];
      if (ret[3]) {
        ptr2 = 0;
        len2 = 0;
        throw takeFromExternrefTable0(ret[2]);
      }
      deferred3_0 = ptr2;
      deferred3_1 = len2;
      return getStringFromWasm0(ptr2, len2);
    } finally {
      wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
  }
  /**
   * `words`: the text of each word of a YomiScript (JSON array of strings) -> a Sentence as JSON
   * @param {string} words
   * @returns {string}
   */
  candidates(words3) {
    let deferred3_0;
    let deferred3_1;
    try {
      const ptr0 = passStringToWasm0(words3, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.frontend_candidates(this.__wbg_ptr, ptr0, len0);
      var ptr2 = ret[0];
      var len2 = ret[1];
      if (ret[3]) {
        ptr2 = 0;
        len2 = 0;
        throw takeFromExternrefTable0(ret[2]);
      }
      deferred3_0 = ptr2;
      deferred3_1 = len2;
      return getStringFromWasm0(ptr2, len2);
    } finally {
      wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
  }
  /**
   * the connection cost from an entry with right id `r` to one with left id `l` (0: the start or end of the
   * sentence; -1: an unknown word, 0 cost)
   * @param {number} r
   * @param {number} l
   * @returns {number}
   */
  conn(r, l) {
    const ret = wasm.frontend_conn(this.__wbg_ptr, r, l);
    return ret;
  }
  /**
   * `request`: `{ words, path, accents? }`, the words as given to `candidates`, the chosen entries in order (indices
   * into its cands) and, optionally, an accent for each in place of the dictionary's -> `[njd, labels]` as `analyze` returns them. An entry that starts inside a word of the YomiScript
   * (and each later part of a compound entry) joins the accent phrase before, so a word is never split between
   * two phrases; marks keep OpenJTalk's rule.
   * @param {string} request
   * @returns {string}
   */
  label(request) {
    let deferred3_0;
    let deferred3_1;
    try {
      const ptr0 = passStringToWasm0(request, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.frontend_label(this.__wbg_ptr, ptr0, len0);
      var ptr2 = ret[0];
      var len2 = ret[1];
      if (ret[3]) {
        ptr2 = 0;
        len2 = 0;
        throw takeFromExternrefTable0(ret[2]);
      }
      deferred3_0 = ptr2;
      deferred3_1 = len2;
      return getStringFromWasm0(ptr2, len2);
    } finally {
      wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
  }
  /**
   * `bytes`: the dictionary files one after another (in the order of DICT_FILES); `lengths`: the length of each;
   * `user`: a user dictionary, rows in the system dictionary's CSV format (one per line, `#` comments), whose
   * entries take part next to the system dictionary's.
   * @param {Uint8Array | number[]} bytes
   * @param {Uint32Array | number[]} lengths
   * @param {string | null} [user]
   */
  constructor(bytes, lengths, user) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
      ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passArray32ToWasm0(lengths, wasm.__wbindgen_malloc);
      len1 = WASM_VECTOR_LEN;
      ptr2 = isLikeNone(user) ? 0 : passStringToWasm0(user, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len2 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr2) {
        wasm.__wbindgen_free(ptr2, len2 * 1, 1);
      }
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 4, 4);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.frontend_new(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    this.__wbg_ptr = ret[0];
    FrontendFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
};
if (Symbol.dispose) Frontend.prototype[Symbol.dispose] = Frontend.prototype.free;
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_Error_208446807d0d1e30: function(arg0, arg1) {
      const ret = Error(getStringFromWasm0(arg0, arg1));
      return ret;
    },
    __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm.__wbindgen_externrefs;
      table.set(0, void 0);
      table.set(1024, void 0);
      table.set(1025, null);
      table.set(1026, true);
      table.set(1027, false);
    }
  };
  return {
    __proto__: null,
    "./frontend_bg.js": import0
  };
}
var FrontendFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_frontend_free(ptr, 1));
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
  if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
    cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
  }
  return cachedUint32ArrayMemory0;
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
function passArray32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getUint32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(bytes) {
  numBytesDecoded += bytes.length;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
    cachedTextDecoder.decode();
    numBytesDecoded = bytes.length;
  }
  return cachedTextDecoder.decode(bytes);
}
var cachedTextEncoder = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN = 0;
var wasmModule;
var wasmInstance;
var wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedUint32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (!module.ok) {
      throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
    }
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = expectedResponseType(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
function initSync(module) {
  if (wasm !== void 0) return wasm;
  if (module !== void 0) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }
  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}
var __wbg_init_promise;
async function __wbg_init(module_or_path) {
  if (wasm !== void 0) return wasm;
  if (__wbg_init_promise === void 0) {
    __wbg_init_promise = __wbg_init_once(module_or_path);
    __wbg_init_promise.catch(() => {
      __wbg_init_promise = void 0;
    });
  }
  return __wbg_init_promise;
}
async function __wbg_init_once(module_or_path) {
  if (module_or_path !== void 0) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  if (module_or_path === void 0) {
    module_or_path = new URL("frontend_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  const { instance, module } = await __wbg_load(await module_or_path, imports);
  return __wbg_finalize_init(instance, module);
}

// node_modules/@yomiscript/ja-accent/dist/userdict.js
var USER_DICT = `
# \u65E5\u672C: \u30CB\u30C3\u30DD\u30F3 (3606) wins over \u30CB\u30DB\u30F3 (10787); \u65E5\u672C\u7D4C\u6E08, \u65E5\u672C\u306E are read \u30CB\u30DB\u30F3 by LLMs
\u65E5\u672C,1354,1354,3000,\u540D\u8A5E,\u56FA\u6709\u540D\u8A5E,\u5730\u57DF,\u56FD,*,*,\u65E5\u672C,\u30CB\u30DB\u30F3,\u30CB\u30DB\u30F3,2/3,C1
# \u65E5\u672C\u4EBA: \u30CB\u30C3\u30DD\u30F3\u30B8\u30F3 (-641) wins over \u30CB\u30DB\u30F3\u30B8\u30F3 (5840)
\u65E5\u672C\u4EBA,1345,1345,-1000,\u540D\u8A5E,\u4E00\u822C,*,*,*,*,\u65E5\u672C\u4EBA,\u30CB\u30DB\u30F3\u30B8\u30F3,\u30CB\u30DB\u30F3\u30B8\u30F3,4/5,C2
# \u3074\u304B\u3074\u304B: NAIST-JDIC has no fall (5055, 5052), where \u304F\u308B\u304F\u308B and the like fall on the first mora (D38)
\u3074\u304B\u3074\u304B,1341,1341,5000,\u526F\u8A5E,\u4E00\u822C,*,*,*,*,\u3074\u304B\u3074\u304B,\u30D4\u30AB\u30D4\u30AB,\u30D4\u30AB\u30D4\u30AB,1/4,*
\u30D4\u30AB\u30D4\u30AB,1341,1341,5000,\u526F\u8A5E,\u4E00\u822C,*,*,*,*,\u30D4\u30AB\u30D4\u30AB,\u30D4\u30AB\u30D4\u30AB,\u30D4\u30AB\u30D4\u30AB,1/4,*
# \u305D\u3046, the adverb: NAIST-JDIC has no fall (2211), so \u305D\u3046\u3060 stayed high to its end and was heard as rising; it falls after \u30BD (D40)
\u305D\u3046,1342,1342,2000,\u526F\u8A5E,\u52A9\u8A5E\u985E\u63A5\u7D9A,*,*,*,*,\u305D\u3046,\u30BD\u30A6,\u30BD\u30FC,1/2,*
# \u5BA4 read \u3078\u3084 and \u6249 read \u3068, as in the books' ruby: NAIST-JDIC has neither, and the phrase was left with no accent, with the words before
# it. Each has \u90E8\u5C4B's or \u6238's accent, and a high cost: it is taken only where the YomiScript reads it so.
\u5BA4,1345,1345,9000,\u540D\u8A5E,\u4E00\u822C,*,*,*,*,\u5BA4,\u30D8\u30E4,\u30D8\u30E4,2/2,C2
\u6249,1345,1345,9000,\u540D\u8A5E,\u4E00\u822C,*,*,*,*,\u6249,\u30C8,\u30C8,0/1,C3
`;

// node_modules/@yomiscript/ja-accent/dist/frontend.js
var DICT_VERSION = "jpreprocess-0.15.0";
var DICT_URL = `https://huggingface.co/receptron/yomiscript-ja-dict/resolve/main/${DICT_VERSION}/`;
var DICT_FILES = ["metadata.json", "char_def.bin", "matrix.mtx", "dict.da", "dict.vals", "dict.wordsidx", "dict.words", "unk.bin"];
async function gunzip(b2) {
  const s = new Blob([b2]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function loadFrontend(load, wasm2) {
  if (wasm2)
    initSync({ module: wasm2 });
  else
    await __wbg_init();
  const parts = await Promise.all(DICT_FILES.map(async (f) => gunzip(await load(`${f}.gz`))));
  const bytes = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  const fe = new Frontend(bytes, Uint32Array.from(parts.map((p) => p.length)), USER_DICT);
  const analysis = (json) => {
    const [njd, labels] = JSON.parse(json);
    return { njd, labels };
  };
  return {
    analyze: (text) => analysis(fe.analyze(text)),
    candidates: (words3) => JSON.parse(fe.candidates(JSON.stringify(words3))),
    conn: (r, l) => fe.conn(r, l),
    label: (words3, path, accents, chain2) => analysis(fe.label(JSON.stringify({ words: words3, path, accents, chain: chain2 })))
  };
}

// node_modules/@yomiscript/ja-accent/dist/nuclei.js
function phraseUnits(sec) {
  const by = /* @__PURE__ */ new Map();
  for (const t of sec.toks)
    if (t.kind === "unit")
      by.set(t.ph, [...by.get(t.ph) ?? [], t]);
  return [...by.values()];
}
function nucleusOf(P) {
  const f = P.findIndex((t) => t.fall);
  return f < 0 ? 0 : f + 1;
}
function marksFor(P, k) {
  if (k === 1)
    return [{ at: P[0].end ?? 0, ins: "\uA71C" }];
  const E = [{ at: P[0].end ?? 0, ins: "\uA71B" }];
  if (k > 1)
    E.push({ at: P[k - 1].end ?? 0, ins: "\uA71C" });
  return E;
}
function withoutJaMarks(ys) {
  const top = parse(ys).top;
  let lang = top, out = "", at = 0;
  const outsideAnnotations = (text) => {
    for (const p of text.split(/(\{\S+|\})/)) {
      if (p === "}")
        lang = top;
      else if (p.startsWith("{"))
        lang = p.slice(1);
      out += isJa(lang) ? p.replace(/[ꜛꜜ]/g, "") : p;
    }
  };
  while (at < ys.length) {
    const open = ys.indexOf("<", at), close = open < 0 ? -1 : ys.indexOf(">", open), end = close < 0 ? ys.length : close + 1;
    outsideAnnotations(ys.slice(at, close < 0 ? end : open));
    if (close >= 0)
      out += ys.slice(open, end);
    at = end;
  }
  return out;
}
function startPhrases(marked2) {
  const bare = withoutJaMarks(marked2), ja = (ys) => parse(ys).sections.filter((s) => isJa(s.lang)), M = ja(marked2);
  const sections = ja(bare).map((sec, s) => {
    const G = phraseUnits(sec), G0 = phraseUnits(M[s]);
    return {
      G,
      start: G0.map((P) => P.length > 1 ? nucleusOf(P) : null),
      kept: G.map((P, i) => P.flatMap((t, j) => [...G0[i][j].rise ? [{ at: t.end ?? 0, ins: "\uA71B" }] : [], ...G0[i][j].fall ? [{ at: t.end ?? 0, ins: "\uA71C" }] : []]))
    };
  });
  return { bare, sections };
}
function phraseEdits2(G, nuclei, kept) {
  return G.flatMap((P, i) => {
    const k = nuclei[i];
    return k === null ? kept[i] : marksFor(P, k);
  });
}

// node_modules/@yomiscript/ja-accent/dist/pitch.js
var PITCH_VERSION = "qwen-2";
var PITCH_URL = `https://huggingface.co/receptron/yomiscript-ja-pitch/resolve/main/${PITCH_VERSION}/`;
var PITCH_FILES = ["pitch.json.gz", "pitch.bin.gz"];
function pitchRows(sec, words3, nuclei) {
  const morae = [], phrases = [];
  const G = phraseUnits(sec), bounds = /* @__PURE__ */ new Map();
  let bound = "start";
  for (const t of sec.toks) {
    if (t.kind === "bound")
      bound = t.sym ?? "";
    if (t.kind !== "unit")
      continue;
    bounds.set(t, bound);
    bound = "";
  }
  G.forEach((P, g) => {
    phrases.push({ start: morae.length, len: P.length, d31: nuclei[g] });
    P.forEach((t, j) => morae.push({
      ipa: t.ipa ?? "",
      span: t.span,
      word: words3[t.span ?? -1] ?? "",
      bound: bounds.get(t) ?? "",
      ppos: j,
      plen: P.length,
      wpos: 0,
      wlen: 0,
      d31nuc: nuclei[g] ?? -1
    }));
  });
  const startsWord = (i) => i === 0 || morae[i - 1].span !== morae[i].span;
  morae.forEach((m, i) => {
    let s = i, e = i;
    while (!startsWord(s))
      s--;
    while (e + 1 < morae.length && !startsWord(e + 1))
      e++;
    m.wpos = i - s;
    m.wlen = e - s + 1;
  });
  return { morae, phrases };
}
var idOf = (V2, key) => Object.hasOwn(V2, key) ? V2[key] : 0;
function embed(M, m) {
  const { vocab: V2, clip, tensors: T } = M, chars = [...m.word], here = m.d31nuc > 0 && m.ppos === m.d31nuc - 1, flatEnd = m.d31nuc === 0 && m.ppos === m.plen - 1, picks = [
    ["emb.0", idOf(V2.ipa, m.ipa)],
    ["emb.1", idOf(V2.word, m.word)],
    ["emb.2", idOf(V2.bound, m.bound)],
    ["pos.0", Math.min(m.ppos, clip)],
    ["pos.1", Math.min(m.plen, clip)],
    ["pos.2", Math.min(m.wpos, clip)],
    ["pos.3", Math.min(m.wlen, clip)],
    ["d31", 1 + Number(here) + 2 * Number(flatEnd) + 3 * Number(m.d31nuc < 0)],
    ["char", chars.length ? idOf(V2.char, chars[0]) : 0],
    ["char", chars.length ? idOf(V2.char, chars[chars.length - 1]) : 0]
  ];
  const vectors = picks.map(([name, id]) => {
    const { shape, data } = T[`${name}.weight`];
    return data.subarray(id * shape[1], (id + 1) * shape[1]);
  });
  const x = new Float64Array(vectors.reduce((n, v) => n + v.length, 0));
  let at = 0;
  for (const v of vectors) {
    x.set(v, at);
    at += v.length;
  }
  return x;
}
var sigmoid = (x) => 1 / (1 + Math.exp(-x));
function lstm(T, suffix, X) {
  const ih = T[`rnn.weight_ih_${suffix}`], hh = T[`rnn.weight_hh_${suffix}`], bi = T[`rnn.bias_ih_${suffix}`].data, bh = T[`rnn.bias_hh_${suffix}`].data, H = hh.shape[1], I = ih.shape[1], h = new Float64Array(H), c = new Float64Array(H), gate = new Float64Array(4 * H);
  return X.map((x) => {
    for (let r = 0; r < 4 * H; r++) {
      let s = bi[r] + bh[r];
      for (let j = 0; j < I; j++)
        s += ih.data[r * I + j] * x[j];
      for (let j = 0; j < H; j++)
        s += hh.data[r * H + j] * h[j];
      gate[r] = s;
    }
    for (let j = 0; j < H; j++) {
      c[j] = sigmoid(gate[H + j]) * c[j] + sigmoid(gate[j]) * Math.tanh(gate[2 * H + j]);
      h[j] = sigmoid(gate[3 * H + j]) * Math.tanh(c[j]);
    }
    return Float64Array.from(h);
  });
}
function pitchResidual(M, morae) {
  const T = M.tensors;
  let X = morae.map((m) => embed(M, m));
  for (let L = 0; T[`rnn.weight_ih_l${L}`]; L++) {
    const fw = lstm(T, `l${L}`, X), bw = lstm(T, `l${L}_reverse`, [...X].reverse()).reverse();
    X = fw.map((f, i) => {
      const both = new Float64Array(f.length + bw[i].length);
      both.set(f);
      both.set(bw[i], f.length);
      return both;
    });
  }
  const { shape, data } = T["out.1.weight"], bias = T["out.1.bias"].data;
  return X.map((x) => Array.from({ length: shape[0] }, (_, r) => {
    let s = bias[r];
    for (let j = 0; j < shape[1]; j++)
      s += data[r * shape[1] + j] * x[j];
    return s;
  }));
}
function withPitch(marked2, M) {
  const { bare, sections } = startPhrases(marked2), U = parse(applyEdits(bare, sections.flatMap((s) => phraseEdits2(s.G, s.start, s.kept)))), ja = (u) => u.sections.filter((s) => isJa(s.lang)), written = ja(parse(marked2)), E = [];
  ja(U).forEach((sec, s) => {
    const contour = jaContour(sec, M.contour), units = phraseUnits(sec).flat(), at = phraseUnits(written[s]).flat(), R = pitchResidual(M, pitchRows(sec, U.texts, sections[s].start).morae);
    units.forEach((t, i) => {
      const base = contour.get(t) ?? [0, 0, 0];
      E.push({ at: at[i].end ?? 0, ins: f0Mark(base.map((v, j) => v + R[i][j])) });
    });
  });
  return applyEdits(marked2, E);
}
function pitchYomite(a, model, opts = {}) {
  return (ys) => {
    const marked2 = accentMarks(ys, a, opts);
    return marked2 === ys ? ys : withPitch(marked2, model);
  };
}
async function loadPitchModel(load) {
  const [meta, bin] = await Promise.all(PITCH_FILES.map(async (f) => gunzip(await load(f))));
  const head = JSON.parse(new TextDecoder().decode(meta)), tensors = {};
  let at = 0;
  for (const [name, shape] of head.tensors) {
    const n = shape.reduce((a, b2) => a * b2, 1);
    tensors[name] = { shape, data: new Float32Array(bin.buffer.slice(bin.byteOffset + at, bin.byteOffset + at + 4 * n)) };
    at += 4 * n;
  }
  if (at !== bin.length)
    throw new Error(`pitch model: ${bin.length} bytes of weights, ${at} expected`);
  return { ...head, tensors };
}

// node_modules/@yomiscript/ja-accent/dist/index.js
function needsAccent(ys) {
  let u;
  try {
    u = parse(ys);
  } catch {
    return false;
  }
  const ja = u.sections.filter((s) => isJa(s.lang));
  return !!u.texts.length && ja.length > 0 && !ja.some((s) => s.toks.some((t) => t.rise || t.fall || t.f0));
}
function accentMarks(ys, a, opts = {}) {
  if (!needsAccent(ys))
    return ys;
  const u = parse(ys), text = u.texts.join(""), { njd, labels } = opts.analysis ? a.analyze(text) : lookupAnalysis(u, a, opts.source, opts.join), P = dictPhrases(text, njd, labels);
  return P ? writeMarks(ys, P).ys : ys;
}
var ACCENT_SCALE = 1;
function accentYomite(a, opts = {}) {
  return (ys) => {
    const marked2 = accentMarks(ys, a, opts);
    return marked2 === ys ? ys : realize(marked2, { markedOnly: true, jaScale: ACCENT_SCALE });
  };
}
async function pitchOrAccentYomite(a, loadModel, onError) {
  try {
    return pitchYomite(a, await loadModel());
  } catch (e) {
    onError?.(e);
    return accentYomite(a);
  }
}

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

// src/text2ys.js
var V = { \u30A2: "a", \u30A4: "i", \u30A6: "\u026F", \u30A8: "e", \u30AA: "o" };
var ROWS = {
  \u30AB\u30AD\u30AF\u30B1\u30B3: ["ka", "ki", "k\u026F", "ke", "ko"],
  \u30AC\u30AE\u30B0\u30B2\u30B4: ["\u0261a", "\u0261i", "\u0261\u026F", "\u0261e", "\u0261o"],
  \u30B5\u30B7\u30B9\u30BB\u30BD: ["sa", "\u0255i", "s\u026F", "se", "so"],
  \u30B6\u30B8\u30BA\u30BC\u30BE: ["dza", "d\u0291i", "dz\u026F", "dze", "dzo"],
  \u30BF\u30C1\u30C4\u30C6\u30C8: ["ta", "t\u0255i", "ts\u026F", "te", "to"],
  \u30C0\u30C2\u30C5\u30C7\u30C9: ["da", "d\u0291i", "dz\u026F", "de", "do"],
  \u30CA\u30CB\u30CC\u30CD\u30CE: ["na", "\u0272i", "n\u026F", "ne", "no"],
  \u30CF\u30D2\u30D5\u30D8\u30DB: ["ha", "\xE7i", "\u0278\u026F", "he", "ho"],
  \u30D0\u30D3\u30D6\u30D9\u30DC: ["ba", "bi", "b\u026F", "be", "bo"],
  \u30D1\u30D4\u30D7\u30DA\u30DD: ["pa", "pi", "p\u026F", "pe", "po"],
  \u30DE\u30DF\u30E0\u30E1\u30E2: ["ma", "mi", "m\u026F", "me", "mo"],
  \u30E9\u30EA\u30EB\u30EC\u30ED: ["\u027Ea", "\u027Ei", "\u027E\u026F", "\u027Ee", "\u027Eo"]
};
var MORA = { ...V };
for (const [k, vs] of Object.entries(ROWS)) [...k].forEach((c, i) => MORA[c] = vs[i]);
Object.assign(MORA, { \u30E4: "ja", \u30E6: "j\u026F", \u30E8: "jo", \u30EF: "wa", \u30F2: "o", \u30F4: "v\u026F", \u30A1: "a", \u30A3: "i", \u30A5: "\u026F", \u30A7: "e", \u30A9: "o", \u30EE: "wa", \u30E3: "ja", \u30E5: "j\u026F", \u30E7: "jo" });
var YO = { \u30AD: "k", \u30AE: "\u0261", \u30B7: "\u0255", \u30B8: "d\u0291", \u30C1: "t\u0255", \u30C2: "d\u0291", \u30CB: "\u0272", \u30D2: "\xE7", \u30D3: "b", \u30D4: "p", \u30DF: "m", \u30EA: "\u027E" };
var PAL = /* @__PURE__ */ new Set(["\u30AD", "\u30AE", "\u30D3", "\u30D4", "\u30DF", "\u30EA"]);
for (const [c, on] of Object.entries(YO))
  for (const [s, v] of [["\u30E3", "a"], ["\u30E5", "\u026F"], ["\u30E7", "o"], ["\u30A7", "e"]]) MORA[c + s] = on + (PAL.has(c) ? "\u02B2" : "") + v;
Object.assign(MORA, {
  \u30C6\u30A3: "ti",
  \u30C7\u30A3: "di",
  \u30C8\u30A5: "t\u026F",
  \u30C9\u30A5: "d\u026F",
  \u30D5\u30A1: "\u0278a",
  \u30D5\u30A3: "\u0278i",
  \u30D5\u30A7: "\u0278e",
  \u30D5\u30A9: "\u0278o",
  \u30A6\u30A3: "wi",
  \u30A6\u30A7: "we",
  \u30A6\u30A9: "wo",
  \u30C4\u30A1: "tsa",
  \u30C4\u30A3: "tsi",
  \u30C4\u30A7: "tse",
  \u30C4\u30A9: "tso",
  \u30F4\u30A1: "va",
  \u30F4\u30A3: "vi",
  \u30F4\u30A7: "ve",
  \u30F4\u30A9: "vo",
  \u30B9\u30A3: "si",
  \u30BA\u30A3: "dzi",
  \u30C6\u30E5: "t\u02B2\u026F",
  \u30C7\u30E5: "d\u02B2\u026F",
  \u30D5\u30E5: "\u0278\u02B2\u026F",
  \u30A4\u30A7: "je",
  \u30AF\u30A1: "kwa",
  \u30B0\u30A1: "\u0261wa"
});
var VOWELS2 = "ai\u026Feo";
function tokens(kana) {
  const s = kana.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 96));
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2), c = s[i];
    if (two.length === 2 && MORA[two]) {
      out.push({ k: "mora", v: MORA[two] });
      i++;
    } else if (c === "\u30C3") out.push({ k: "Q" });
    else if (c === "\u30F3") out.push({ k: "N" });
    else if (c === "\u30FC") out.push({ k: "R" });
    else if (MORA[c]) out.push({ k: "mora", v: MORA[c] });
    else return null;
  }
  return out;
}
function nAllophone(nxt) {
  if (!nxt || nxt === "N") return "\u0274";
  if ("pbm".includes(nxt[0])) return "m";
  if (/^(tɕ|dʑ|ɲ)/.test(nxt)) return "\u0272";
  if ("tdn\u027E".includes(nxt[0]) || nxt.startsWith("dz")) return "n";
  if ("k\u0261".includes(nxt[0])) return "\u014B";
  return "\u0274";
}
function njdWords2(njd) {
  return njd.map((line) => {
    const f = line.split(","), n = f.length;
    return { text: f.slice(0, n - 12).join(","), pos: f[n - 12], pron: f[n - 4].replace(/[’']/g, "") };
  });
}
function wordsToYs(words3) {
  const W2 = words3.map((w) => ({ ...w, toks: w.pos === "\u8A18\u53F7" ? null : tokens(w.pron) }));
  const flat = [];
  W2.forEach((w, wi) => (w.toks || []).forEach((t) => flat.push({ ...t, wi })));
  const nextSeg = (i) => {
    const t = flat[i + 1];
    return !t ? null : t.k === "mora" ? t.v : t.k === "N" ? "N" : null;
  };
  const ipa = W2.map(() => "");
  let lastV = false;
  flat.forEach((t, i) => {
    const nxt = nextSeg(i);
    let s;
    if (t.k === "mora") {
      s = t.v;
      lastV = true;
    } else if (t.k === "N") {
      s = nAllophone(nxt);
      lastV = false;
    } else if (t.k === "Q") {
      s = nxt && nxt !== "N" && !(VOWELS2 + "jw").includes(nxt[0]) ? /^(ts|tɕ)/.test(nxt) ? "t" : nxt[0] : "\u0294";
      lastV = false;
    } else s = lastV ? "\u02D0" : "";
    ipa[t.wi] += s;
  });
  const units = [];
  let lead = "", carry = null;
  W2.forEach((w, wi) => {
    if (ipa[wi]) {
      const endsQ = w.toks[w.toks.length - 1].k === "Q" && !ipa[wi].endsWith("\u0294");
      const u = carry ? { ipa: carry.ipa + ipa[wi], t: carry.t + w.text } : { ipa: ipa[wi], t: lead + w.text };
      lead = "";
      carry = null;
      if (endsQ) carry = u;
      else units.push(u);
    } else if (carry) carry.t += w.text;
    else if (/^[、，,]$/.test(w.text) && units.length) units.push({ ipa: "\u2016", t: w.text });
    else if (units.length) units[units.length - 1].t += w.text;
    else lead += w.text;
  });
  if (carry) units.push({ ipa: carry.ipa.replace(/[^aiɯeoːɴmnŋɲ]$/, "\u0294"), t: carry.t });
  while (units.length && units[units.length - 1].ipa === "\u2016") {
    const u = units.pop();
    if (units.length) units[units.length - 1].t += u.t;
  }
  if (!units.some((u) => u.ipa !== "\u2016")) return null;
  const esc = (t) => t.replace(/[<>/\\]/g, " ");
  const question = /[?？]\s*$/.test(words3.map((w) => w.text).join(""));
  return "ja /" + units.map((u) => `${u.ipa}<t:${esc(u.t)}>`).join(" ") + (question ? " \u2197/" : " \u2198/");
}
function splitSentences(text) {
  const out = [];
  for (const para of text.split(/\n+/)) {
    const parts = para.match(/[^。！？!?]+[。！？!?」』）)]*|[。！？!?]+/g) || [];
    parts.forEach((p, i) => {
      p = p.trim();
      if (!p) return;
      const pieces = [];
      if (p.length <= 90) pieces.push(p);
      else {
        let cur = "";
        for (const seg of p.split(/(?<=[、，,])/)) {
          if (cur && (cur + seg).length > 90) {
            pieces.push(cur);
            cur = "";
          }
          cur += seg;
          while (cur.length > 140) {
            pieces.push(cur.slice(0, 120));
            cur = cur.slice(120);
          }
        }
        if (cur) pieces.push(cur);
      }
      pieces.forEach((x, k) => out.push({ text: x, para: i === parts.length - 1 && k === pieces.length - 1 }));
    });
  }
  return out;
}

// src/engine.js
var analyzer = null;
var accent = null;
var worker = null;
var starting = null;
var nextId = 0;
var mode = "cpu";
var waiting = /* @__PURE__ */ new Map();
var chain = Promise.resolve();
var onProgress = () => {
};
var totalMs = 0;
var totalSec = 0;
function send(ys, voice) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker.postMessage({ id, ys, voice });
  });
}
function failAll(msg) {
  for (const w of waiting.values()) w.reject(new Error(msg));
  waiting.clear();
}
function init(progress) {
  if (progress) onProgress = progress;
  if (starting) return starting;
  starting = (async () => {
    mode = navigator.gpu ? "gpu" : "cpu";
    const q = mode === "gpu" ? "ep=webgpu&t=4&gp=dec" : "ep=wasm&t=4";
    onProgress("Starting the natural voice (first time: about 190 MB download)...");
    worker = new Worker(new URL("worker.js?v=5&" + q, import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (data.progress) {
        onProgress(data.progress);
        return;
      }
      if (data.fatal) {
        failAll(data.fatal);
        return;
      }
      const w = waiting.get(data.id);
      if (!w) return;
      waiting.delete(data.id);
      data.error ? w.reject(new Error(data.error)) : w.resolve(data);
    };
    worker.onerror = (e) => failAll(e.message || "voice worker error");
    const ready = send(null);
    onProgress("Downloading the Japanese dictionary (28 MB, first time only)...");
    analyzer = await loadFrontend(modelBytes(await modelFetcher(DICT_URL)));
    accent = await pitchOrAccentYomite(analyzer, async () => loadPitchModel(modelBytes(await modelFetcher(PITCH_URL))), () => {
    });
    onProgress("Loading the voice model (163 MB, first time only)...");
    const r = await ready;
    if (mode === "gpu" && !r.gpu) mode = "cpu";
    return { mode, threads: r.threads };
  })();
  starting.catch(() => {
    starting = null;
    try {
      worker && worker.terminate();
    } catch {
    }
    worker = null;
  });
  return starting;
}
var pcmOf = async (blob) => new Int16Array((await blob.arrayBuffer()).slice(44));
function wav(pcm, sr = 24e3) {
  const b2 = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b2), str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  new Int16Array(b2, 44).set(pcm);
  return new Blob([b2], { type: "audio/wav" });
}
function synth(text, voice = "jf_alpha") {
  const work = chain = chain.catch(() => {
  }).then(async () => {
    await init();
    const pcs = [];
    let ms = 0, any = false;
    for (const s of splitSentences(text)) {
      let ys = null, plain = null;
      try {
        plain = wordsToYs(njdWords2(analyzer.analyze(s.text).njd));
        ys = plain;
        if (ys) {
          try {
            ys = accent(ys);
          } catch {
          }
        }
      } catch {
      }
      if (!ys) continue;
      let got;
      try {
        got = await send(ys, voice);
      } catch (e) {
        if (plain && plain !== ys) got = await send(plain, voice);
        else throw e;
      }
      pcs.push(await pcmOf(got.blob));
      ms += got.ms;
      any = true;
      pcs.push(new Int16Array(Math.round(24e3 * 0.12)));
    }
    if (!any) return null;
    pcs.pop();
    const n = pcs.reduce((a, p) => a + p.length, 0), all = new Int16Array(n);
    let at = 0;
    for (const p of pcs) {
      all.set(p, at);
      at += p.length;
    }
    const seconds = n / 24e3;
    totalMs += ms;
    totalSec += seconds;
    return { blob: wav(all), seconds, ms };
  });
  return work;
}
var stats = () => ({ mode, speed: totalSec ? totalMs / 1e3 / totalSec : 0, seconds: totalSec });
export {
  init,
  stats,
  synth
};
