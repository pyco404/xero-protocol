import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../Logo";
import { useLayout } from "../layout";
import { SceneShell } from "../SceneShell";
import { SNAP } from "../theme";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { square } = useLayout();
  const size = square ? 460 : 520;
  // Brackets start far apart (logo units) and snap together.
  const p = spring({ frame: frame - 8, fps, config: SNAP });
  const spread = (1 - p) * 900;
  return (
    <SceneShell fadeIn={false}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Logo size={size} leftX={-spread} rightX={spread} showMark={false} />
      </AbsoluteFill>
    </SceneShell>
  );
};
