// Generates one voiceover file per scene into public/vo/ and records durations in
// src/vo-manifest.json, which src/timeline.ts uses to time each scene (audio + 0.5s).
//
// Provider order: ElevenLabs (ELEVENLABS_API_KEY) -> OpenAI tts-1-hd "onyx" (OPENAI_API_KEY)
// -> Kokoro, a free open-source model that runs locally (no key; downloads ~90MB on first run).
// Set VO_PROVIDER=none to clear the voiceover and render captions-only.
import { mkdirSync, writeFileSync, rmSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { SCRIPT } from "../src/script.ts";

const MANIFEST = new URL("../src/vo-manifest.json", import.meta.url);
const VO_DIR = new URL("../public/vo/", import.meta.url);

// "Adam": calm, confident male narrator. Override with ELEVENLABS_VOICE_ID.
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB";

const elevenlabs = async (text) => {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
};

const openai = async (text) => {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "tts-1-hd", voice: "onyx", input: text, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
};

// Calm American male. Override with KOKORO_VOICE (e.g. bm_george, am_fenrir).
const KOKORO_VOICE = process.env.KOKORO_VOICE ?? "am_michael";
let kokoroModel;
const kokoro = async (text) => {
  if (!kokoroModel) {
    const { KokoroTTS } = await import("kokoro-js");
    kokoroModel = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  }
  const audio = await kokoroModel.generate(text, { voice: KOKORO_VOICE, speed: 0.95 });
  const wav = new URL("../public/vo/_tmp.wav", import.meta.url).pathname;
  await audio.save(wav);
  const mp3 = execFileSync("ffmpeg", ["-v", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "160k", "-f", "mp3", "-"]);
  unlinkSync(wav);
  return mp3;
};

// Spelled for the voice only; captions keep the brand spelling.
const spoken = (text) => text.replace(/\bXERO\b/g, "Zero").replace(/\bdevnet\b/g, "dev-net");

const provider =
  process.env.VO_PROVIDER ??
  (process.env.ELEVENLABS_API_KEY ? "elevenlabs" : process.env.OPENAI_API_KEY ? "openai" : "kokoro");

if (provider === "none") {
  writeFileSync(MANIFEST, JSON.stringify({ provider: null, scenes: {} }, null, 2) + "\n");
  console.log("VO_PROVIDER=none: cleared voiceover, video will render captions-only.");
  process.exit(0);
}

const synth = { elevenlabs, openai, kokoro }[provider];
if (!synth) throw new Error(`Unknown VO_PROVIDER: ${provider}`);
rmSync(VO_DIR, { recursive: true, force: true });
mkdirSync(VO_DIR, { recursive: true });

const scenes = {};
for (const scene of SCRIPT) {
  const file = `vo/${scene.id}.mp3`;
  const path = new URL(`../public/${file}`, import.meta.url);
  // Normalize every clip to spoken-word loudness so it sits clearly above the music.
  const raw = new URL(`../public/vo/_${scene.id}.mp3`, import.meta.url).pathname;
  writeFileSync(raw, await synth(spoken(scene.vo)));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", path.pathname]);
  unlinkSync(raw);
  const seconds = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.pathname]).toString().trim(),
  );
  scenes[scene.id] = { file, seconds: Math.round(seconds * 1000) / 1000 };
  console.log(`${scene.id}: ${seconds.toFixed(2)}s`);
}

writeFileSync(MANIFEST, JSON.stringify({ provider, scenes }, null, 2) + "\n");
console.log(`Wrote ${Object.keys(scenes).length} voiceover files via ${provider}.`);
