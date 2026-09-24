import { loadFont } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

export const COLORS = {
  bg: "#1A1A1A",
  fg: "#FFFFFF",
  gray: "#8A8A8A",
} as const;

export const FONT = fontFamily;

/** Snappy but settled spring used for bracket "snap" moments. */
export const SNAP = { damping: 14, stiffness: 180, mass: 0.6 } as const;
/** Softer spring for entrances. */
export const EASE_IN = { damping: 200, stiffness: 120, mass: 0.8 } as const;
