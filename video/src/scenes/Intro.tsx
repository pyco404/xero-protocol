import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../Logo";
import { useLayout } from "../layout";
import { SceneShell } from "../SceneShell";
import { COLORS, EASE_IN, SNAP } from "../theme";

const WORD = "ZERO NETWORK";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { square } = useLayout();

  const brackets = spring({ frame, fps, config: SNAP });
  const drop = spring({ frame: frame - 14, fps, config: SNAP });
  const slash = interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Logo slides aside to make room for the wordmark.
  const shift = spring({ frame: frame - 44, fps, config: EASE_IN });
  const typed = Math.max(0, Math.min(WORD.length, Math.floor((frame - 54) / 3)));
  const cursorOn = Math.floor(frame / 15) % 2 === 0 || (typed > 0 && typed < WORD.length);

  const logoSize = square ? 300 : 340;
  const wordSize = square ? 74 : 104;

  const logo = (
    <Logo
      size={logoSize}
      leftX={-(1 - brackets) * 160}
      rightX={(1 - brackets) * 160}
      markY={-(1 - drop) * 520}
      markOpacity={drop > 0.01 ? 1 : 0}
      slash={slash}
    />
  );
  // The invisible full word fixes the layout; typed text and cursor overlay it.
  const word = (
    <div style={{ position: "relative", fontSize: wordSize, fontWeight: 700, letterSpacing: 6, lineHeight: 1 }}>
      <span style={{ visibility: "hidden" }}>{WORD}</span>
      <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "pre" }}>
        {WORD.slice(0, typed)}
        <span style={{ opacity: typed < WORD.length && cursorOn && frame >= 50 ? 1 : 0 }}>_</span>
      </span>
    </div>
  );

  return (
    <SceneShell>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 90 }}>
        <div
          style={{
            display: "flex",
            flexDirection: square ? "column" : "row",
            alignItems: "center",
            gap: square ? 40 : 70,
          }}
        >
          <div style={{ transform: square ? `translateY(${(1 - shift) * 120}px)` : `translateX(${(1 - shift) * 300}px)` }}>
            {logo}
          </div>
          <div style={{ opacity: shift }}>
            {word}
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
