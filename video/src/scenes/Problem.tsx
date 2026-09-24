import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "../layout";
import { SceneShell } from "../SceneShell";
import { COLORS, EASE_IN } from "../theme";

const Node: React.FC<{
  x: number;
  y: number;
  r: number;
  label: string;
  appear: number;
  children?: React.ReactNode;
}> = ({ x, y, r, label, appear, children }) => (
  <g opacity={appear} transform={`translate(${x} ${y}) scale(${0.85 + 0.15 * appear})`}>
    <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={COLORS.bg} stroke={COLORS.fg} strokeWidth={3} />
    {children}
    <text y={r + 40} textAnchor="middle" fill={COLORS.gray} fontSize={24} letterSpacing={2}>
      {label}
    </text>
  </g>
);

const ApiIcon = () => (
  <text y={12} textAnchor="middle" fill={COLORS.fg} fontSize={34} fontWeight={700}>
    {"</>"}
  </text>
);
const DataIcon = () => (
  <g fill="none" stroke={COLORS.fg} strokeWidth={3}>
    <ellipse cx={0} cy={-18} rx={24} ry={8} />
    <path d="M -24 -18 V 18 A 24 8 0 0 0 24 18 V -18" />
    <path d="M -24 0 A 24 8 0 0 0 24 0" />
  </g>
);
const ComputeIcon = () => (
  <g fill="none" stroke={COLORS.fg} strokeWidth={3}>
    <rect x={-18} y={-18} width={36} height={36} />
    <rect x={-7} y={-7} width={14} height={14} fill={COLORS.fg} />
    {[-10, 0, 10].map((o) => (
      <g key={o}>
        <line x1={o} y1={-18} x2={o} y2={-27} />
        <line x1={o} y1={18} x2={o} y2={27} />
        <line x1={-18} y1={o} x2={-27} y2={o} />
        <line x1={18} y1={o} x2={27} y2={o} />
      </g>
    ))}
  </g>
);
const AgentIcon = () => (
  <g fill="none" stroke={COLORS.fg} strokeWidth={3}>
    <rect x={-26} y={-18} width={52} height={36} />
    <line x1={0} y1={-18} x2={0} y2={-30} />
    <rect x={-14} y={-6} width={8} height={8} fill={COLORS.fg} />
    <rect x={6} y={-6} width={8} height={8} fill={COLORS.fg} />
  </g>
);

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { width, height, square } = useLayout();

  const midY = square ? 470 : 470;
  const wallet = { x: width * (square ? 0.16 : 0.2), y: midY };
  const agent = { x: width * (square ? 0.47 : 0.48), y: midY };
  const svcX = width * (square ? 0.83 : 0.77);
  const gap = square ? 230 : 240;
  const services = [
    { label: "API", y: midY - gap, Icon: ApiIcon },
    { label: "DATA", y: midY, Icon: DataIcon },
    { label: "COMPUTE", y: midY + gap, Icon: ComputeIcon },
  ];
  const r = square ? 58 : 66;

  const appear = (delay: number) => spring({ frame: frame - delay, fps, config: EASE_IN });
  const flowStart = 30;

  // Balance drains over the scene, accelerating in the second half.
  const t = interpolate(frame, [flowStart, durationInFrames - 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const remaining = 1 - Math.pow(t, 1.6) * 0.97;
  const balance = (1000 * remaining).toFixed(2);

  // Packets: each service line carries a stream of small squares.
  const packets: React.ReactNode[] = [];
  services.forEach((s, i) => {
    for (let k = 0; k < 6; k++) {
      const local = frame - flowStart - i * 7 - k * 16;
      if (local < 0) continue;
      const u = (local % 48) / 48;
      const x = agent.x + r + (svcX - r - agent.x - r) * u;
      const y = agent.y + (s.y - agent.y) * u;
      packets.push(<rect key={`${i}-${k}`} x={x - 5} y={y - 5} width={10} height={10} fill={COLORS.fg} />);
    }
  });
  // Wallet -> agent feed.
  for (let k = 0; k < 4; k++) {
    const local = frame - flowStart + 10 - k * 12;
    if (local < 0) continue;
    const u = (local % 48) / 48;
    const x = wallet.x + r + (agent.x - r - wallet.x - r) * u;
    packets.push(<rect key={`w-${k}`} x={x - 5} y={wallet.y - 5} width={10} height={10} fill={COLORS.gray} />);
  }

  const lineOpacity = appear(18);
  const barW = r * 2 - 24;
  return (
    <SceneShell>
      <AbsoluteFill>
        <svg width={width} height={height} fontFamily="inherit">
          <g stroke={COLORS.gray} strokeWidth={2} strokeDasharray="6 8" opacity={lineOpacity}>
            <line x1={wallet.x + r} y1={wallet.y} x2={agent.x - r} y2={agent.y} />
            {services.map((s) => (
              <line key={s.label} x1={agent.x + r} y1={agent.y} x2={svcX - r} y2={s.y} />
            ))}
          </g>
          {packets}
          <Node x={wallet.x} y={wallet.y} r={r} label="WALLET" appear={appear(0)}>
            <g fill="none" stroke={COLORS.fg} strokeWidth={3}>
              <rect x={-28} y={-20} width={56} height={40} />
              <path d="M 28 -8 H 12 V 8 H 28" />
            </g>
          </Node>
          <g opacity={appear(0)}>
            <text x={wallet.x} y={wallet.y - r - 56} textAnchor="middle" fill={COLORS.fg} fontSize={square ? 30 : 34} fontWeight={700}>
              {balance}
            </text>
            <rect x={wallet.x - barW / 2} y={wallet.y - r - 34} width={barW} height={6} fill={COLORS.gray} opacity={0.35} />
            <rect x={wallet.x - barW / 2} y={wallet.y - r - 34} width={barW * remaining} height={6} fill={COLORS.fg} />
          </g>
          <Node x={agent.x} y={agent.y} r={r} label="AGENT" appear={appear(6)}>
            <AgentIcon />
          </Node>
          {services.map((s, i) => (
            <Node key={s.label} x={svcX} y={s.y} r={r * 0.8} label={s.label} appear={appear(12 + i * 4)}>
              <s.Icon />
            </Node>
          ))}
        </svg>
      </AbsoluteFill>
    </SceneShell>
  );
};
