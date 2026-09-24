import React from "react";
import { COLORS } from "./theme";

// Geometry traced from public/xero-logo-white.png on its 500x500 canvas.
const STROKE = 40;
const BRACKET_TOP = 29;
const BRACKET_BOTTOM = 463;
const ARM = 121;

export const Bracket: React.FC<{ side: "left" | "right"; color?: string }> = ({
  side,
  color = COLORS.fg,
}) => {
  const x = side === "left" ? 29 : 469 - STROKE;
  const armX = side === "left" ? 29 : 469 - ARM;
  return (
    <g fill={color}>
      <rect x={x} y={BRACKET_TOP} width={STROKE} height={BRACKET_BOTTOM - BRACKET_TOP} />
      <rect x={armX} y={BRACKET_TOP} width={ARM} height={STROKE - 2} />
      <rect x={armX} y={BRACKET_BOTTOM - STROKE + 2} width={ARM} height={STROKE - 2} />
    </g>
  );
};

/** The square-with-slash mark. `slash` 0..1 draws the diagonal in. */
export const Mark: React.FC<{ slash?: number; color?: string }> = ({
  slash = 1,
  color = COLORS.fg,
}) => {
  const x0 = 169;
  const y0 = 335;
  const x1 = 329;
  const y1 = 159;
  return (
    <g>
      <rect
        x={132 + 18.5}
        y={122 + 18.5}
        width={233 - 37}
        height={249 - 37}
        fill="none"
        stroke={color}
        strokeWidth={37}
      />
      <clipPath id="xero-inner">
        <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} />
      </clipPath>
      <line
        x1={x0 - 10}
        y1={y0 + 11}
        x2={x0 - 10 + (x1 - x0 + 20) * slash}
        y2={y0 + 11 - (y0 - y1 + 22) * slash}
        stroke={color}
        strokeWidth={34}
        clipPath="url(#xero-inner)"
      />
    </g>
  );
};

/**
 * The full mark, with each part independently positionable (in 500-unit logo space)
 * so scenes can animate the brackets and mark separately.
 */
export const Logo: React.FC<{
  size: number;
  leftX?: number;
  rightX?: number;
  markY?: number;
  markOpacity?: number;
  markScale?: number;
  slash?: number;
  bracketColor?: string;
  showMark?: boolean;
}> = ({
  size,
  leftX = 0,
  rightX = 0,
  markY = 0,
  markOpacity = 1,
  markScale = 1,
  slash = 1,
  bracketColor,
  showMark = true,
}) => (
  <svg width={size} height={size} viewBox="0 0 500 500" style={{ overflow: "visible" }}>
    <g transform={`translate(${leftX} 0)`}>
      <Bracket side="left" color={bracketColor} />
    </g>
    <g transform={`translate(${rightX} 0)`}>
      <Bracket side="right" color={bracketColor} />
    </g>
    {showMark ? (
      <g
        opacity={markOpacity}
        transform={`translate(${250} ${246 + markY}) scale(${markScale}) translate(-250 -246)`}
      >
        <Mark slash={slash} />
      </g>
    ) : null}
  </svg>
);
