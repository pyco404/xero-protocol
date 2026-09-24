import React from "react";
import { Composition } from "remotion";
import { FPS, totalFrames } from "./timeline";
import { XeroIntro } from "./XeroIntro";

export const Root: React.FC = () => (
  <>
    <Composition id="XeroIntro" component={XeroIntro} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} />
    <Composition id="XeroIntroSquare" component={XeroIntro} durationInFrames={totalFrames()} fps={FPS} width={1080} height={1080} />
  </>
);
