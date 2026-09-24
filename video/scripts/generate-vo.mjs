// Generates one voiceover file per scene into public/vo/ and records durations in
// src/vo-manifest.json, which src/timeline.ts uses to time each scene (audio + 0.5s).
//
// Provider order: ElevenLabs (ELEVENLABS_API_KEY) -> OpenAI tts-1-hd "onyx" (OPENAI_API_KEY).
// With neither key set, the manifest is cleared and the video renders captions-only.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
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

const provider = process.env.ELEVENLABS_API_KEY ? "elevenlabs" : process.env.OPENAI_API_KEY ? "openai" : null;

if (!provider) {
  writeFileSync(MANIFEST, JSON.stringify({ provider: null, scenes: {} }, null, 2) + "\n");
  console.log("No ELEVENLABS_API_KEY or OPENAI_API_KEY set: cleared voiceover, video will render captions-only.");
  process.exit(0);
}

const synth = provider === "elevenlabs" ? elevenlabs : openai;
rmSync(VO_DIR, { recursive: true, force: true });
mkdirSync(VO_DIR, { recursive: true });

const scenes = {};
for (const scene of SCRIPT) {
  const file = `vo/${scene.id}.mp3`;
  const path = new URL(`../public/${file}`, import.meta.url);
  writeFileSync(path, await synth(scene.vo));
  const seconds = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.pathname]).toString().trim(),
  );
  scenes[scene.id] = { file, seconds: Math.round(seconds * 1000) / 1000 };
  console.log(`${scene.id}: ${seconds.toFixed(2)}s`);
}

writeFileSync(MANIFEST, JSON.stringify({ provider, scenes }, null, 2) + "\n");
console.log(`Wrote ${Object.keys(scenes).length} voiceover files via ${provider}.`);
