import React from "react";
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "../layout";
import { OUTRO_URL } from "../script";
import { SceneShell } from "../SceneShell";
import { COLORS, EASE_IN } from "../theme";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { square } = useLayout();
  const a = spring({ frame, fps, config: EASE_IN });
  const b = spring({ frame: frame - 14, fps, config: EASE_IN });
  const c = spring({ frame: frame - 26, fps, config: EASE_IN });
  const size = square ? 260 : 280;
  return (
    <SceneShell>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 110 }}>
        <Img
          src={staticFile("zero-logo-white.png")}
          style={{ width: size, height: size, opacity: a, transform: `scale(${0.94 + 0.06 * a})` }}
        />
        <div style={{ marginTop: 36, fontSize: square ? 38 : 46, fontWeight: 500, opacity: b }}>
          Programmable money for agents
        </div>
        <div style={{ marginTop: 18, fontSize: square ? 26 : 30, color: COLORS.gray, opacity: c, letterSpacing: 1 }}>
          {OUTRO_URL}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
