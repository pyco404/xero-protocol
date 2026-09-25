import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "../layout";
import { SceneShell } from "../SceneShell";
import { COLORS, EASE_IN, SNAP } from "../theme";

const CODE = `const spender = await zero.createSpender({
  maxPerPayment: "5",
  dailyLimit: "20",
  allowedProviders: [dataApi],
});
await spender.pay({ recipient: dataApi, amount: "0.42" });`;

const KEYWORDS = new Set(["const", "await"]);

/** Monochrome highlighting: keywords and punctuation gray, everything else white. */
const tokenize = (src: string) =>
  src.split(/("[^"]*"?|\b\w+\b|\s+|[^\w\s"])/).filter(Boolean).map((tok) => {
    if (KEYWORDS.has(tok)) return { tok, color: COLORS.gray };
    if (/^[^\w\s"]$/.test(tok)) return { tok, color: COLORS.gray };
    return { tok, color: COLORS.fg };
  });

export const Developers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { square } = useLayout();

  const typeStart = 12;
  const typeEnd = durationInFrames - 70;
  const chars = Math.floor(
    Math.max(0, Math.min(1, (frame - typeStart) / (typeEnd - typeStart))) * CODE.length,
  );
  const visible = CODE.slice(0, chars);
  const done = chars >= CODE.length;
  const cursorOn = !done || Math.floor(frame / 15) % 2 === 0;

  const winIn = spring({ frame, fps, config: EASE_IN });
  const snap = spring({ frame: frame - typeEnd - 4, fps, config: SNAP });
  const fontSize = square ? 23 : 32;
  const pad = square ? 36 : 52;

  return (
    <SceneShell>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 100 }}>
        <div style={{ position: "relative", opacity: winIn, transform: `translateY(${(1 - winIn) * 20}px)` }}>
          <div style={{ border: `2px solid ${COLORS.gray}`, background: COLORS.bg }}>
            <div
              style={{
                borderBottom: `2px solid ${COLORS.gray}`,
                padding: "12px 20px",
                fontSize: fontSize * 0.7,
                color: COLORS.gray,
                letterSpacing: 1,
              }}
            >
              agent.ts
            </div>
            <pre
              style={{
                margin: 0,
                padding: pad,
                fontFamily: "inherit",
                fontSize,
                lineHeight: 1.6,
                whiteSpace: "pre",
                position: "relative",
              }}
            >
              {/* Invisible full text reserves final size so the window never resizes. */}
              <span style={{ visibility: "hidden" }}>{CODE}</span>
              <span style={{ position: "absolute", left: pad, top: pad }}>
                {tokenize(visible).map((t, i) => (
                  <span key={i} style={{ color: t.color }}>{t.tok}</span>
                ))}
                <span style={{ opacity: cursorOn ? 1 : 0, color: COLORS.fg }}>▍</span>
              </span>
            </pre>
          </div>
          {/* Brackets snap around the finished code: the call runs inside policy. */}
          {[-1, 1].map((dir) => (
            <div
              key={dir}
              style={{
                position: "absolute",
                top: -24,
                bottom: -24,
                [dir < 0 ? "left" : "right"]: -44 - (1 - snap) * 80,
                width: 30,
                border: `12px solid ${COLORS.fg}`,
                [dir < 0 ? "borderRight" : "borderLeft"]: "none",
                opacity: snap,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
    </SceneShell>
  );
};
