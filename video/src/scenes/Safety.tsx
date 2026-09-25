import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { lineWindows } from "../Captions";
import { useLayout } from "../layout";
import { SceneShell } from "../SceneShell";
import { COLORS, EASE_IN, SNAP } from "../theme";

const FIRE_EVERY = 7;
const TO_BRACKET = 16;
const BOUNCE = 12;

/** A compromised agent fires payments that bounce off the policy brackets until the owner pauses it. */
export const Safety: React.FC<{ captions: string[]; speechFrames: number }> = ({ captions, speechFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { square } = useLayout();
  const w = lineWindows(captions, speechFrames);

  const glitchAt = w[0].start + 4;
  const fireAt = w[0].start + 14;
  const pauseAt = w[2].start + 12;

  const L = square
    ? { bl: 190, br: 890, top: 170, bottom: 690, t: 18, arm: 50, agent: 72 }
    : { bl: 400, br: 1200, top: 150, bottom: 760, t: 22, arm: 56, agent: 86 };
  const cx = square ? 400 : 640;
  const cy = (L.top + L.bottom) / 2;

  const inAnim = spring({ frame, fps, config: EASE_IN });
  const glitching = frame >= glitchAt && frame < pauseAt;
  const paused = frame >= pauseAt;
  const press = spring({ frame: frame - pauseAt, fps, config: SNAP });
  // Brackets tighten a little once the agent is paused: everything is back within policy.
  const tighten = paused ? press * 24 : 0;

  // Glitch: jitter on a 2-frame grid plus a red offset ghost.
  const g = Math.floor(frame / 2);
  const jx = glitching ? (random(`x${g}`) - 0.5) * 16 : 0;
  const jy = glitching ? (random(`y${g}`) - 0.5) * 8 : 0;
  const ghost = glitching ? 6 + random(`g${g}`) * 8 : 0;
  const agentColor = paused ? COLORS.gray : glitching ? COLORS.alert : COLORS.fg;

  // Packets fired toward the right bracket, bouncing back on impact.
  const startX = cx + L.agent / 2 + 10;
  const wallX = L.br - tighten - 12;
  const packets: React.ReactNode[] = [];
  for (let k = 0; fireAt + k * FIRE_EVERY < pauseAt; k++) {
    const t0 = fireAt + k * FIRE_EVERY;
    const local = frame - t0;
    if (local < 0 || local > TO_BRACKET + BOUNCE) continue;
    const yOff = (random(`p${k}`) - 0.5) * (L.bottom - L.top - 160);
    let x: number;
    let y: number;
    let color: string = COLORS.fg;
    let opacity = 1;
    if (local <= TO_BRACKET) {
      const u = local / TO_BRACKET;
      x = startX + (wallX - startX) * u;
      y = cy + yOff * u;
    } else {
      const u = (local - TO_BRACKET) / BOUNCE;
      x = wallX - 70 * u;
      y = cy + yOff + 30 * u * (yOff > 0 ? 1 : -1);
      color = COLORS.gray;
      opacity = 1 - u;
    }
    packets.push(<rect key={k} x={x - 8} y={y - 8} width={16} height={16} fill={color} opacity={opacity} />);
  }

  const labelSize = square ? 18 : 22;
  const btn = { w: square ? 220 : 240, h: square ? 64 : 70 };
  const btnX = square ? L.br - btn.w - 60 : L.br + 120;
  const btnY = square ? L.bottom + 60 : cy - btn.h / 2;
  const btnScale = paused ? 1 - 0.08 * Math.sin(Math.min(1, (frame - pauseAt) / 6) * Math.PI) : 1;

  const Agent = ({ color, dx = 0 }: { color: string; dx?: number }) => (
    <g transform={`translate(${cx + jx + dx} ${cy + jy})`}>
      <rect x={-L.agent / 2} y={-L.agent / 2} width={L.agent} height={L.agent} fill="none" stroke={color} strokeWidth={3} />
      <line x1={0} y1={-L.agent / 2} x2={0} y2={-L.agent / 2 - 14} stroke={color} strokeWidth={3} />
      <rect x={-18} y={-8} width={11} height={11} fill={color} />
      <rect x={7} y={-8} width={11} height={11} fill={color} />
    </g>
  );

  return (
    <SceneShell>
      <AbsoluteFill>
        <svg width="100%" height="100%" style={{ opacity: inAnim }}>
          {glitching ? (
            <g opacity={0.6}>
              <Agent color={COLORS.alert} dx={ghost} />
            </g>
          ) : null}
          <Agent color={agentColor} />
          <text x={cx} y={cy + L.agent / 2 + 44} textAnchor="middle" fill={paused ? COLORS.gray : COLORS.fg} fontSize={labelSize} letterSpacing={2}>
            {paused ? "PAUSED" : "AGENT"}
          </text>

          {packets}

          {/* Policy brackets */}
          {(["left", "right"] as const).map((side) => {
            const x = side === "left" ? L.bl + tighten : L.br - tighten;
            const ax = side === "left" ? x : x + L.t - L.arm;
            const hitNow =
              side === "right" &&
              !paused &&
              frame >= fireAt + TO_BRACKET &&
              (frame - fireAt - TO_BRACKET) % FIRE_EVERY < 2;
            return (
              <g key={side} fill={COLORS.fg} transform={`translate(${hitNow ? 3 : 0} 0)`}>
                <rect x={x} y={L.top} width={L.t} height={L.bottom - L.top} />
                <rect x={ax} y={L.top} width={L.arm} height={L.t} />
                <rect x={ax} y={L.bottom - L.t} width={L.arm} height={L.t} />
              </g>
            );
          })}

          {/* Owner's pause control */}
          <g transform={`translate(${btnX + btn.w / 2} ${btnY + btn.h / 2}) scale(${btnScale}) translate(${-btn.w / 2} ${-btn.h / 2})`}>
            <rect width={btn.w} height={btn.h} fill={paused ? COLORS.fg : COLORS.bg} stroke={COLORS.fg} strokeWidth={3} />
            <rect x={28} y={btn.h / 2 - 12} width={7} height={24} fill={paused ? COLORS.bg : COLORS.fg} />
            <rect x={41} y={btn.h / 2 - 12} width={7} height={24} fill={paused ? COLORS.bg : COLORS.fg} />
            <text x={70} y={btn.h / 2 + 8} fill={paused ? COLORS.bg : COLORS.fg} fontSize={labelSize + 2} fontWeight={700} letterSpacing={2}>
              {paused ? "PAUSED" : "PAUSE"}
            </text>
          </g>
          <text
            x={btnX + btn.w / 2}
            y={btnY + btn.h + (square ? 34 : 40)}
            textAnchor="middle"
            fill={COLORS.gray}
            fontSize={labelSize - 2}
            letterSpacing={2}
          >
            OWNER
          </text>

          <text
            x={(L.bl + L.br + L.t) / 2}
            y={L.bottom + (square ? 42 : 50)}
            textAnchor="middle"
            fill={COLORS.gray}
            fontSize={labelSize}
            letterSpacing={4}
            opacity={interpolate(frame, [w[1].start, w[1].start + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (square ? 0 : 1)}
          >
            DAMAGE CAPPED
          </text>
        </svg>
      </AbsoluteFill>
    </SceneShell>
  );
};
