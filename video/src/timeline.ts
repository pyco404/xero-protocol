import { staticFile } from "remotion";
import manifest from "./vo-manifest.json";
import { SCRIPT, type SceneId, type SceneScript } from "./script";

export const FPS = 30;
/** Padding added after each scene's voiceover, per the brief. */
const VO_TAIL_SECONDS = 0.5;

interface ManifestEntry {
  file: string;
  seconds: number;
}

const voScenes = (manifest as { scenes: Partial<Record<SceneId, ManifestEntry>> }).scenes;

export interface TimedScene extends SceneScript {
  from: number;
  durationInFrames: number;
  audioSrc: string | null;
  /** Frames during which speech is present; captions are spread over this window. */
  speechFrames: number;
}

export const buildTimeline = (): TimedScene[] => {
  let from = 0;
  return SCRIPT.map((scene) => {
    const vo = voScenes[scene.id];
    const seconds = vo ? vo.seconds + VO_TAIL_SECONDS : scene.fallbackSeconds;
    const durationInFrames = Math.round(seconds * FPS);
    const speechFrames = vo
      ? Math.round(vo.seconds * FPS)
      : durationInFrames - Math.round(0.6 * FPS);
    const timed: TimedScene = {
      ...scene,
      from,
      durationInFrames,
      audioSrc: vo ? staticFile(vo.file) : null,
      speechFrames,
    };
    from += durationInFrames;
    return timed;
  });
};

export const totalFrames = (): number =>
  buildTimeline().reduce((sum, s) => sum + s.durationInFrames, 0);

export const hasVoiceover = (): boolean => Object.keys(voScenes).length > 0;
