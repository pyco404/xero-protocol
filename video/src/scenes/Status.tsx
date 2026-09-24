import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "../layout";
import { SceneShell } from "../SceneShell";
import { COLORS, EASE_IN } from "../theme";

export const Status: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { square } = useLayout();
  const a = spring({ frame: frame - 4, fps, config: EASE_IN });
  const b = spring({ frame: frame - 50, fps, config: EASE_IN });
  const pulse = (frame % 40) / 40;
  const dot = square ? 20 : 24;
  return (
    <SceneShell>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 90 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: square ? 34 : 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 30,
              fontSize: square ? 58 : 76,
              fontWeight: 700,
              opacity: a,
              transform: `translateY(${(1 - a) * 16}px)`,
            }}
          >
            <div style={{ position: "relative", width: dot, height: dot }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: COLORS.fg }} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `2px solid ${COLORS.fg}`,
                  transform: `scale(${1 + pulse * 1.8})`,
                  opacity: interpolate(pulse, [0, 1], [0.8, 0]),
                }}
              />
            </div>
            Live on Solana devnet
          </div>
          <div style={{ fontSize: square ? 30 : 36, color: COLORS.gray, opacity: b, transform: `translateY(${(1 - b) * 12}px)` }}>
            Private payments: in development
          </div>
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
