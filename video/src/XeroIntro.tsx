import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { Captions } from "./Captions";
import { Developers } from "./scenes/Developers";
import { Hook } from "./scenes/Hook";
import { How } from "./scenes/How";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { Problem } from "./scenes/Problem";
import { Status } from "./scenes/Status";
import type { SceneId } from "./script";
import { COLORS } from "./theme";
import { buildTimeline } from "./timeline";
import musicManifest from "./music.json";

const renderScene = (id: SceneId, captions: string[], speechFrames: number) => {
  switch (id) {
    case "hook":
      return <Hook />;
    case "problem":
      return <Problem />;
    case "intro":
      return <Intro />;
    case "how":
      return <How captions={captions} speechFrames={speechFrames} />;
    case "developers":
      return <Developers />;
    case "status":
      return <Status />;
    case "outro":
      return <Outro />;
  }
};

export const XeroIntro: React.FC = () => {
  const { durationInFrames, fps } = useVideoConfig();
  const timeline = buildTimeline();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {timeline.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={s.id}>
          {renderScene(s.id, s.captions, s.speechFrames)}
          <Captions lines={s.captions} speechFrames={s.speechFrames} />
          {s.audioSrc ? <Audio src={s.audioSrc} /> : null}
        </Sequence>
      ))}
      {musicManifest.file ? (
        <Audio
          src={staticFile(musicManifest.file)}
          volume={(f) =>
            interpolate(
              f,
              [0, fps * 2, durationInFrames - fps * 3, durationInFrames],
              [0, musicManifest.volume, musicManifest.volume, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
