import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { useLayout } from "./layout";
import { COLORS, FONT } from "./theme";

const LEAD_IN = 6;

/** Splits the speech window across caption lines in proportion to their length. */
export const lineWindows = (lines: string[], speechFrames: number) => {
  const total = lines.reduce((n, l) => n + l.length, 0);
  let cursor = LEAD_IN;
  const span = speechFrames - LEAD_IN;
  return lines.map((text, i) => {
    const len = Math.round((text.length / total) * span);
    const start = cursor;
    cursor += len;
    // Hold the final line until the scene fades.
    return { text, start, end: i === lines.length - 1 ? Infinity : cursor };
  });
};

export const Captions: React.FC<{ lines: string[]; speechFrames: number }> = ({
  lines,
  speechFrames,
}) => {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const active = lineWindows(lines, speechFrames).find((w) => frame >= w.start && frame < w.end);
  if (!active) return null;
  const opacity = interpolate(frame, [active.start, active.start + 4], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: square ? 64 : 72 }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: square ? 30 : 34,
          fontWeight: 500,
          color: COLORS.fg,
          backgroundColor: "rgba(26,26,26,0.85)",
          padding: "6px 16px",
          opacity,
          letterSpacing: -0.3,
          textAlign: "center",
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};
