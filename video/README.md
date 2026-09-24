# XERO intro video

A ~60s explainer built with [Remotion](https://remotion.dev). It renders at 1920x1080 and at 1080x1080 for X.

```bash
npm install
npm run studio   # preview and scrub in the browser
npm run vo       # generate the voiceover (see below)
npm run stills   # one still per scene -> out/stills/
npm run render   # out/xero-intro-1920x1080.mp4 + out/xero-intro-1080x1080.mp4
```

## Voiceover

`npm run vo` synthesizes one file per scene into `public/vo/` and writes the durations to `src/vo-manifest.json`. Each scene then lasts as long as its audio plus 0.5s.

- `ELEVENLABS_API_KEY` set: uses ElevenLabs. Override the voice with `ELEVENLABS_VOICE_ID`.
- Otherwise, `OPENAI_API_KEY` set: uses OpenAI `tts-1-hd`, voice `onyx`.
- Neither key set: clears the manifest, and each scene falls back to the `fallbackSeconds` in `src/script.ts`.

To use your own recording instead, put `public/vo/<scene-id>.mp3` files in place and fill `src/vo-manifest.json` by hand. The format is `{ "scenes": { "hook": { "file": "vo/hook.mp3", "seconds": 3.1 } } }`.

## Editing

- VO text, caption lines, and the outro URL live in `src/script.ts`. The outro URL is a placeholder: replace `OUTRO_URL`.
- The music is a synthesized ambient drone (`npm run music`), so there is no license to track. Set `"file": null` in `src/music.json` to remove it.
