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

// node_modules/@yomiscript/supertonic/dist/text.js
var CLOSING = new Set("\u3001\u3002\uFF0C\uFF0E\uFF1F\uFF01?!\u300D\u300F\uFF09)\u2026");

// node_modules/@yomiscript/supertonic/dist/preprocess.js
var SUPERTONIC_LANGUAGES = [
  "en",
  "ko",
  "ja",
  "ar",
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "es",
  "et",
  "fi",
  "fr",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "lt",
  "lv",
  "nl",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "tr",
  "uk",
  "vi"
];
var EMOJI_RANGES = [
  [128512, 128591],
  [127744, 128511],
  [128640, 128767],
  [128768, 128895],
  [128896, 129023],
  [129024, 129279],
  [129280, 129535],
  [129536, 129647],
  [129648, 129791],
  [9728, 9983],
  [9984, 10175],
  [127462, 127487]
];
var isEmoji = (c) => {
  const cp = c.codePointAt(0) ?? 0;
  return EMOJI_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
};
var SYMBOLS = [
  ["\u2013", "-"],
  ["\u2011", "-"],
  ["\u2014", "-"],
  ["\xAF", " "],
  ["_", " "],
  ["\u201C", '"'],
  ["\u201D", '"'],
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\xB4", "'"],
  ["`", "'"],
  ["[", " "],
  ["]", " "],
  ["|", " "],
  ["/", " "],
  ["#", " "],
  ["\u2192", " "],
  ["\u2190", " "]
];
var EXPRESSIONS = [
  ["@", " at "],
  ["e.g.,", "for example, "],
  ["i.e.,", "that is, "]
];
var SPACE_BEFORE = [
  [/ ,/g, ","],
  [/ \./g, "."],
  [/ !/g, "!"],
  [/ \?/g, "?"],
  [/ ;/g, ";"],
  [/ :/g, ":"],
  [/ '/g, "'"]
];
var ENDING = /[.!?;:,'")\]}…。」』】〉》›»]$/;
function preprocess(text, lang) {
  text = Array.from(text.normalize("NFKD")).filter((c) => !isEmoji(c)).join("");
  for (const [a, b] of SYMBOLS)
    text = text.replaceAll(a, b);
  text = text.replace(/[♥☆♡©\\]/g, "");
  for (const [a, b] of EXPRESSIONS)
    text = text.replaceAll(a, b);
  for (const [re, b] of SPACE_BEFORE)
    text = text.replace(re, b);
  text = text.replace(/(["'`])\1+/g, "$1").replace(/\s+/g, " ").trim();
  if (!ENDING.test(text))
    text += ".";
  return lang === void 0 ? text : `<${lang}>${text}</${lang}>`;
}
function unsupported(text, indexer) {
  const bad = /* @__PURE__ */ new Set();
  for (const ch of new Set(Array.from(text)))
    for (const c of Array.from(preprocess(ch))) {
      const cp = c.codePointAt(0) ?? 0;
      if (cp >= indexer.length || indexer[cp] === -1)
        bad.add(ch);
    }
  return [...bad].sort();
}
function textIds(preprocessed, indexer) {
  return Array.from(preprocessed, (c) => {
    const id = indexer[c.codePointAt(0) ?? 0];
    if (id === void 0 || id < 0)
      throw new Error(`Supertonic has no input for ${JSON.stringify(c)}`);
    return id;
  });
}
var ABBREVIATIONS = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "Prof.",
  "Sr.",
  "Jr.",
  "Ph.D.",
  "etc.",
  "e.g.",
  "i.e.",
  "vs.",
  "Inc.",
  "Ltd.",
  "Co.",
  "Corp.",
  "St.",
  "Ave.",
  "Blvd."
];
var isSpace = (c) => c !== void 0 && /\s/.test(c);
function sentenceEnd(before) {
  if (!".!?".includes(before.at(-1) ?? " "))
    return false;
  return !ABBREVIATIONS.some((a) => before.endsWith(a)) && !/\b[A-Z]\.$/.test(before);
}
function sentences(paragraph) {
  const out = [];
  let from = 0;
  for (let i = 0; i < paragraph.length; i++) {
    if (!isSpace(paragraph[i]) || isSpace(paragraph[i - 1]) || !sentenceEnd(paragraph.slice(0, i)))
      continue;
    out.push(paragraph.slice(from, i));
    let j = i;
    while (isSpace(paragraph[j]))
      j++;
    from = j;
  }
  out.push(paragraph.slice(from));
  return out;
}
var cpLength = (s) => Array.from(s).length;
function sentenceChunks(paragraph, maxLen, chunks) {
  let cur = "";
  for (const s of sentences(paragraph).map((x) => x.trim())) {
    if (!s)
      continue;
    if (cpLength(cur) + cpLength(s) + 1 <= maxLen)
      cur += (cur ? " " : "") + s;
    else {
      if (cur)
        chunks.push(cur.trim());
      cur = s;
    }
  }
  if (cur.trim())
    chunks.push(cur.trim());
}
function chunkText(text, maxLen = 300) {
  const chunks = [];
  for (const paragraph of text.trim().split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean))
    sentenceChunks(paragraph, maxLen, chunks);
  return chunks;
}

// node_modules/@yomiscript/supertonic/dist/engine.js
var DEFAULTS = { voice: "F1", steps: 8, speed: 1.05, silence: 0.3 };
var f32 = Math.fround;
var decode = (b) => JSON.parse(new TextDecoder().decode(b));
function uniforms(n) {
  const u = crypto.getRandomValues(new Uint32Array(n));
  return Float64Array.from(u, (x) => (x + 0.5) / 2 ** 32);
}
function gaussian(n) {
  const out = new Float32Array(n), u = uniforms(n + n % 2);
  for (let i = 0; i < n; i += 2) {
    const r = Math.sqrt(-2 * Math.log(u[i]));
    out[i] = r * Math.cos(2 * Math.PI * u[i + 1]);
    if (i + 1 < n)
      out[i + 1] = r * Math.sin(2 * Math.PI * u[i + 1]);
  }
  return out;
}
function latentSize(dur, cfg) {
  const chunk = cfg.baseChunkSize * cfg.chunkCompressFactor, wav2 = f32(dur * cfg.sampleRate), wavLength = Math.trunc(wav2);
  return { wavLength, latentLength: Math.trunc(f32(f32(wav2 + chunk - 1) / chunk)), maskLength: Math.floor((wavLength + chunk - 1) / chunk) };
}
var SupertonicEngine = class {
  ort;
  load;
  sessions;
  styles = {};
  indexer;
  cfg;
  constructor(ort, load) {
    this.ort = ort;
    this.load = load;
  }
  async init(opts = {}) {
    const tts = decode(await this.load("onnx/tts.json"));
    this.cfg = {
      sampleRate: tts.ae.sample_rate,
      baseChunkSize: tts.ae.base_chunk_size,
      chunkCompressFactor: tts.ttl.chunk_compress_factor,
      latentDim: tts.ttl.latent_dim
    };
    this.indexer = decode(await this.load("onnx/unicode_indexer.json"));
    const options = {
      executionProviders: opts.executionProviders ?? ["wasm"],
      graphOptimizationLevel: "all",
      executionMode: "sequential"
    };
    const mk = async (f) => this.ort.InferenceSession.create(await this.load(`onnx/${f}.onnx`), options);
    this.sessions = { dp: await mk("duration_predictor"), enc: await mk("text_encoder"), vec: await mk("vector_estimator"), voc: await mk("vocoder") };
    return this;
  }
  async style(name) {
    if (this.styles[name])
      return this.styles[name];
    const j = decode(await this.load(`voice_styles/${name}.json`));
    const t = (x) => new this.ort.Tensor("float32", Float32Array.from(x.data.flat(Infinity)), x.dims);
    this.styles[name] = { ttl: t(j.style_ttl), dp: t(j.style_dp) };
    return this.styles[name];
  }
  /** the characters of text the model cannot read */
  unsupported(text) {
    return unsupported(text, this.indexer);
  }
  async synthesize(text, opts) {
    const o = { ...DEFAULTS, ...opts };
    if (!text.trim())
      throw new Error("Text cannot be empty");
    const bad = this.unsupported(text);
    if (bad.length)
      throw new Error(`Supertonic cannot read ${bad.length} character(s): ${bad.join(" ")}`);
    const style = await this.style(o.voice), chunks = chunkText(text, o.maxChunkLength ?? (o.lang === "ko" ? 120 : 300));
    const parts = [], durations = [];
    for (const [i, chunk] of chunks.entries()) {
      const r = await this.infer(chunk, style, o, (n) => o.noise ? o.noise(n, i) : gaussian(n));
      parts.push(r.wav);
      durations.push(r.dur);
    }
    return { samples: concatenate(parts, Math.trunc(o.silence * this.cfg.sampleRate)), sampleRate: this.cfg.sampleRate, durations, chunks };
  }
  /** one chunk: text ids -> duration -> noisy latent -> denoised in `steps` steps -> waveform */
  async infer(chunk, style, o, noise) {
    const T = this.ort.Tensor, S = this.sessions;
    const ids = textIds(preprocess(chunk, o.lang), this.indexer);
    const text_ids = new T("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]), text_mask = new T("float32", new Float32Array(ids.length).fill(1), [1, 1, ids.length]);
    const dp = await S.dp.run({ text_ids, style_dp: style.dp, text_mask });
    const dur = f32(dp[S.dp.outputNames[0]].data[0] / f32(o.speed));
    const enc = await S.enc.run({ text_ids, style_ttl: style.ttl, text_mask });
    const text_emb = enc[S.enc.outputNames[0]];
    const { latentLength, maskLength } = latentSize(dur, this.cfg), dim = this.cfg.latentDim * this.cfg.chunkCompressFactor;
    const mask = Float32Array.from({ length: latentLength }, (_, t) => t < maskLength ? 1 : 0);
    let x = noise(dim * latentLength).map((v, i) => v * mask[i % latentLength]);
    const latent_mask = new T("float32", mask, [1, 1, latentLength]), total_step = new T("float32", Float32Array.of(o.steps), [1]);
    for (let step = 0; step < o.steps; step++) {
      const r = await S.vec.run({
        noisy_latent: new T("float32", x, [1, dim, latentLength]),
        text_emb,
        style_ttl: style.ttl,
        text_mask,
        latent_mask,
        current_step: new T("float32", Float32Array.of(step), [1]),
        total_step
      });
      x = Float32Array.from(r[S.vec.outputNames[0]].data);
    }
    const voc = await S.voc.run({ latent: new T("float32", x, [1, dim, latentLength]) });
    return { wav: Float32Array.from(voc[S.voc.outputNames[0]].data), dur };
  }
};
function concatenate(parts, gap) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0) + gap * (parts.length - 1));
  let at = 0;
  for (const [i, p] of parts.entries()) {
    out.set(p, at);
    at += p.length + (i < parts.length - 1 ? gap : 0);
  }
  return out;
}

// node_modules/@yomiscript/supertonic/dist/katarite.js
var SUPPORTED = new Set(SUPERTONIC_LANGUAGES);

// node_modules/@yomiscript/supertonic/dist/index.js
var AMBIGUOUS_URL = new URL("../data/ambiguous.json", import.meta.url);
var SUPERTONIC_MODELS_URL = "https://huggingface.co/Supertone/supertonic-3/resolve/main/";

// src/st_worker.js
var ORT = new URL("ort/", self.location.href).href;
var WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrome\//.test(navigator.userAgent);
var threads = 1;
var bytesLoaded = 0;
function wav(f322, sr) {
  const n = f322.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  const pcm = new Int16Array(b, 44);
  for (let i = 0; i < n; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(f322[i] * 32767)));
  return new Blob([b], { type: "audio/wav" });
}
async function start() {
  const Q = new URL(self.location.href).searchParams;
  const ort = await import(
    /* @vite-ignore */
    ORT + "ort.wasm.min.mjs"
  );
  ort.env.wasm.wasmPaths = ORT;
  threads = self.crossOriginIsolated && !WEBKIT ? Math.max(1, Math.min(+Q.get("t") || 4, navigator.hardwareConcurrency || 1)) : 1;
  ort.env.wasm.numThreads = threads;
  const fetchModel = await modelFetcher(SUPERTONIC_MODELS_URL);
  const bytes = modelBytes(async (path) => {
    self.postMessage({ progress: `Downloading voice: ${path}` });
    return fetchModel(path);
  });
  const E = new SupertonicEngine(ort, async (f) => {
    const b = await bytes(f);
    bytesLoaded += b.byteLength;
    return b;
  });
  await E.init({ executionProviders: ["wasm"] });
  self.postMessage({ progress: "Warming up the voice..." });
  await E.synthesize("\u3042\u3002", { lang: "ja", voice: Q.get("voice") || "F1" });
  return E;
}
var engine = start();
engine.catch((e) => self.postMessage({ fatal: String(e && e.message || e) }));
self.onmessage = async ({ data: { id, text, voice, steps, speed } }) => {
  try {
    const E = await engine;
    if (text == null) {
      self.postMessage({ id, threads, mb: Math.round(bytesLoaded / 1048576) });
      return;
    }
    const t0 = performance.now();
    const bad = E.unsupported(text);
    const clean = bad.length ? [...text].filter((c) => !bad.includes(c)).join("") : text;
    const r = await E.synthesize(clean, { lang: "ja", voice: voice || "F1", steps: steps || 8, speed: speed || 1.05 });
    self.postMessage({ id, blob: wav(r.samples, r.sampleRate), seconds: r.samples.length / r.sampleRate, ms: performance.now() - t0 });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message || e) });
  }
};
