import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Bracket } from "../Logo";
import { lineWindows } from "../Captions";
import { useLayout } from "../layout";
import { SceneShell } from "../SceneShell";
import { COLORS, EASE_IN, SNAP } from "../theme";

const RULES = [
  { title: "Max per payment", value: "5.00" },
  { title: "Daily limit", value: "20.00" },
  { title: "Approved recipients", value: "dataApi" },
  { title: "Pause", value: "off" },
];

/** A bracket drawn to an arbitrary height, keeping the logo's proportions for arms. */
const TallBracket: React.FC<{ side: "left" | "right"; x: number; top: number; bottom: number; t: number; color: string }> = ({
  side,
  x,
  top,
  bottom,
  t,
  color,
}) => {
  const arm = 56;
  const ax = side === "left" ? x : x + t - arm;
  return (
    <g fill={color}>
      <rect x={x} y={top} width={t} height={bottom - top} />
      <rect x={ax} y={top} width={arm} height={t} />
      <rect x={ax} y={bottom - t} width={arm} height={t} />
    </g>
  );
};

export const How: React.FC<{ captions: string[]; speechFrames: number }> = ({ captions, speechFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height, square } = useLayout();
  const w = lineWindows(captions, speechFrames);
  const mid = (i: number) => Math.round((w[i].start + (w[i].end === Infinity ? w[i].start + 60 : w[i].end)) / 2);

  const cardAt = [w[1].start, mid(1), w[2].start, mid(2)];
  const allowedAt = w[3].start + 6;
  const blockedAt = w[4].start + 4;
  const enforcedAt = w[5].start;

  // Geometry. The right gutter inside the brackets is where payments travel.
  const L = square
    ? { bl: 150, br: 912, top: 110, bottom: 820, agentX: 70, recipX: 1000, t: 18, gutter: 110 }
    : { bl: 470, br: 1462, top: 110, bottom: 840, agentX: 230, recipX: 1720, t: 22, gutter: 170 };
  const inner = { x: L.bl + L.t + 36, w: L.br - L.bl - L.t - 36 - L.gutter };
  const vault = { x: inner.x, y: L.top + 50, w: inner.w, h: square ? 150 : 170 };
  const cardGap = 20;
  const cardW = (inner.w - cardGap) / 2;
  const cardH = square ? 150 : 170;
  const cardsTop = vault.y + vault.h + 40;

  const vaultIn = spring({ frame: frame - 4, fps, config: EASE_IN });
  const bracketSnap = spring({ frame: frame - 10, fps, config: SNAP });
  const spread = (1 - bracketSnap) * 140;

  // Payments leave the rules area horizontally and cross the right bracket.
  const startX = inner.x + inner.w + 14;
  const okY = vault.y + vault.h / 2;
  const badY = cardsTop + cardH + cardGap + cardH / 2;
  const bracketX = L.br;
  const okDst = { x: L.recipX, y: okY };
  const badDst = { x: L.recipX, y: badY };

  const travel = (at: number, dur: number) =>
    interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const okU = travel(allowedAt, 24);
  const okX = startX + (okDst.x - 40 - startX) * okU;
  // Blocked packet stops flush against the bracket.
  const badStopX = bracketX - 12;
  const badX = Math.min(startX + (okDst.x - startX) * travel(blockedAt, 24), badStopX);
  const hit = frame >= blockedAt && badX >= badStopX;
  const hitFrame = blockedAt + Math.ceil((24 * (badStopX - startX)) / (okDst.x - startX));
  const jolt = hit ? Math.sin((frame - hitFrame) * 1.6) * Math.max(0, 8 - (frame - hitFrame)) : 0;
  const violation = spring({ frame: frame - hitFrame, fps, config: SNAP });
  const enforced = spring({ frame: frame - enforcedAt, fps, config: EASE_IN });
  const okArrived = spring({ frame: frame - allowedAt - 24, fps, config: SNAP });
  const balance = frame >= allowedAt + 24 ? "499.58" : "500.00";

  const labelSize = square ? 18 : 22;
  const agentY = okY;

  return (
    <SceneShell>
      <AbsoluteFill>
        <svg width={width} height={height}>
          {/* Agent, which triggers payments */}
          <g opacity={vaultIn}>
            <line x1={L.agentX + 40} y1={agentY} x2={L.bl - 10} y2={agentY} stroke={COLORS.gray} strokeWidth={2} strokeDasharray="6 8" />
            <rect x={L.agentX - 40} y={agentY - 40} width={80} height={80} fill={COLORS.bg} stroke={COLORS.fg} strokeWidth={3} />
            <rect x={L.agentX - 14} y={agentY - 8} width={9} height={9} fill={COLORS.fg} />
            <rect x={L.agentX + 5} y={agentY - 8} width={9} height={9} fill={COLORS.fg} />
            <text x={L.agentX} y={agentY + 72} textAnchor="middle" fill={COLORS.gray} fontSize={labelSize} letterSpacing={2}>AGENT</text>
          </g>

          {/* Recipients */}
          {[
            { p: okDst, label: "dataApi", sub: "approved", on: okArrived },
            { p: badDst, label: "unknown", sub: "not approved", on: 0 },
          ].map(({ p, label, sub, on }) => (
            <g key={label} opacity={vaultIn}>
              <line x1={startX} y1={p.y} x2={p.x - 40} y2={p.y} stroke={COLORS.gray} strokeWidth={2} strokeDasharray="6 8" opacity={0.5} />
              <circle cx={p.x} cy={p.y} r={34} fill={on ? COLORS.fg : COLORS.bg} fillOpacity={on} stroke={COLORS.fg} strokeWidth={3} />
              <text x={p.x} y={p.y + 66} textAnchor="middle" fill={COLORS.fg} fontSize={labelSize}>{label}</text>
              <text x={p.x} y={p.y + 66 + labelSize + 6} textAnchor="middle" fill={COLORS.gray} fontSize={labelSize - 4}>{sub}</text>
            </g>
          ))}

          {/* Vault */}
          <g opacity={vaultIn} transform={`translate(0 ${(1 - vaultIn) * 20})`}>
            <rect x={vault.x} y={vault.y} width={vault.w} height={vault.h} fill="none" stroke={COLORS.fg} strokeWidth={3} />
            <text x={vault.x + 28} y={vault.y + 46} fill={COLORS.gray} fontSize={labelSize} letterSpacing={3}>VAULT</text>
            <text x={vault.x + 28} y={vault.y + vault.h - 34} fill={COLORS.fg} fontSize={square ? 48 : 58} fontWeight={700}>{balance}</text>
            <text x={vault.x + vault.w - 28} y={vault.y + 46} textAnchor="end" fill={COLORS.gray} fontSize={labelSize}>funded</text>
          </g>

          {/* Rule cards */}
          {RULES.map((rule, i) => {
            const s = spring({ frame: frame - cardAt[i], fps, config: SNAP });
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = inner.x + col * (cardW + cardGap);
            const y = cardsTop + row * (cardH + cardGap);
            return (
              <g key={rule.title} opacity={Math.min(1, s * 1.5)} transform={`translate(${(1 - s) * (col ? 60 : -60)} 0)`}>
                <rect x={x} y={y} width={cardW} height={cardH} fill={COLORS.bg} stroke={COLORS.gray} strokeWidth={2} />
                <text x={x + 22} y={y + 42} fill={COLORS.gray} fontSize={labelSize - 2} letterSpacing={1}>{`0${i + 1}`}</text>
                <text x={x + 22} y={y + cardH / 2 + 12} fill={COLORS.fg} fontSize={square ? 22 : 27} fontWeight={500}>{rule.title}</text>
                <text x={x + 22} y={y + cardH - 26} fill={COLORS.gray} fontSize={labelSize}>{rule.value}</text>
              </g>
            );
          })}

          {/* Packets */}
          {frame >= allowedAt && okU < 1 ? (
            <g>
              <rect x={okX - 9} y={okY - 9} width={18} height={18} fill={COLORS.fg} />
              <text x={okX + 9} y={okY - 22} textAnchor="end" fill={COLORS.fg} fontSize={labelSize - 4}>0.42</text>
            </g>
          ) : null}
          {frame >= blockedAt ? (
            <g>
              <rect x={badX - 9} y={badY - 9} width={18} height={18} fill={hit ? COLORS.gray : COLORS.fg} />
              <text x={badX + 9} y={badY - 22} textAnchor="end" fill={hit ? COLORS.gray : COLORS.fg} fontSize={labelSize - 4}>0.42</text>
            </g>
          ) : null}

          {/* Policy brackets */}
          <g transform={`translate(${-spread} 0)`}>
            <TallBracket side="left" x={L.bl} top={L.top} bottom={L.bottom} t={L.t} color={COLORS.fg} />
          </g>
          <g transform={`translate(${spread + jolt} 0)`}>
            <TallBracket side="right" x={L.br} top={L.top} bottom={L.bottom} t={L.t} color={COLORS.fg} />
          </g>

          {/* Violation label */}
          {hit ? (
            <g opacity={violation}>
              <text
                x={bracketX - 14}
                y={badY + cardH / 2 + 46}
                textAnchor="end"
                fill={COLORS.gray}
                fontSize={labelSize}
                fontWeight={700}
              >
                PolicyViolation
              </text>
            </g>
          ) : null}

          {/* Enforced on-chain */}
          <text
            x={(L.bl + L.br + L.t) / 2}
            y={L.bottom + (square ? 42 : 46)}
            textAnchor="middle"
            fill={COLORS.gray}
            fontSize={labelSize}
            letterSpacing={4}
            opacity={enforced}
          >
            ENFORCED ON-CHAIN
          </text>
        </svg>
      </AbsoluteFill>
    </SceneShell>
  );
};
