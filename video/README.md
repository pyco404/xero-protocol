# ZERO intro video

A ~60s explainer built with [Remotion](https://remotion.dev). It renders at 1920x1080 and at 1080x1080 for X.

```bash
npm install
npm run studio   # preview and scrub in the browser
npm run vo       # generate the voiceover (see below)
npm run stills   # one still per scene -> out/stills/
npm run render   # out/zero-intro-1920x1080.mp4 + out/zero-intro-1080x1080.mp4
```

## Voiceover

`npm run vo` synthesizes one file per scene into `public/vo/` and writes the durations to `src/vo-manifest.json`. Each scene then lasts as long as its audio plus 0.5s.

- `ELEVENLABS_API_KEY` set: uses ElevenLabs. Override the voice with `ELEVENLABS_VOICE_ID`.
- Otherwise, `OPENAI_API_KEY` set: uses OpenAI `tts-1-hd`, voice `onyx`.
- Neither key set: uses [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), a free open-source voice that runs locally. The model is about 90MB and downloads on the first run. The default voice is `am_michael`; set `KOKORO_VOICE` to change it, e.g. `bm_george`.
- `VO_PROVIDER=none`: removes the voiceover. Each scene then falls back to the `fallbackSeconds` in `src/script.ts`.

Every clip is normalized to -16 LUFS. In the audio only, "ZERO" is spelled "Zero" so the voice doesn't read it letter by letter.

To use your own recording instead, put `public/vo/<scene-id>.mp3` files in place and fill `src/vo-manifest.json` by hand. The format is `{ "scenes": { "hook": { "file": "vo/hook.mp3", "seconds": 3.1 } } }`.

## Editing

- VO text, caption lines, and the outro URL live in `src/script.ts`. The outro URL is a placeholder: replace `OUTRO_URL`.
- The music is a synthesized ambient drone (`npm run music`), so there is no license to track. Set `"file": null` in `src/music.json` to remove it.
