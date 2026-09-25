import React from "react";
import { Composition } from "remotion";
import { FPS, totalFrames } from "./timeline";
import { ZeroIntro } from "./ZeroIntro";

export const Root: React.FC = () => (
  <>
    <Composition id="ZeroIntro" component={ZeroIntro} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} />
    <Composition id="ZeroIntroSquare" component={ZeroIntro} durationInFrames={totalFrames()} fps={FPS} width={1080} height={1080} />
  </>
);
