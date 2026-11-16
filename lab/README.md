# Voice Lab (experiment)

A test page, separate from the AtsuMail app, to hear Japanese read by the open-source
[yomiscript](https://github.com/receptron/yomiscript) engine (Kokoro-82M voice) in the browser.

- Open: https://anishimori123.github.io/AtsuMail/lab/
- First use downloads about 190 MB (voice model 163 MB + dictionary 28 MB) from Hugging Face; kept in the browser afterwards.
- Readings come from the OpenJTalk dictionary (no AI), then yomiscript adds pitch accent, then Kokoro speaks.
- `coi-sw.js` turns on multi-thread "fast mode" for this folder only.

Third-party code in this folder (not written for AtsuMail):
- `main.js`, `worker.js`: bundles that include `@yomiscript/core`, `@yomiscript/kokoro`, `@yomiscript/ja-accent` (Apache-2.0, receptron) and `model_cache.js` from the yomiscript demo.
- `frontend_bg.wasm`: `@yomiscript/ja-accent` (jpreprocess / NAIST-JDIC front end; see that package's NOTICE).
- `ort/`: onnxruntime-web 1.22.0 (MIT, Microsoft).

- `engine.js`: the same engine as a module for the AtsuMail app's "Natural (beta)" JA voice (bundles the same packages as `main.js`).
- `test.html`, `st_worker.js`: speed/sound test for on-device voices; `st_worker.js` bundles `@yomiscript/supertonic` (Apache-2.0). Supertonic 3 model weights (downloaded at run time from Hugging Face, not stored here) are under OpenRAIL-M.
