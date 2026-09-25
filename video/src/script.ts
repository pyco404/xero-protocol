// Single source of truth for the voiceover script. scripts/generate-vo.mjs reads this file
// to synthesize one audio file per scene; captions are derived from `captions`.

export type SceneId =
  | "hook"
  | "problem"
  | "intro"
  | "how"
  | "safety"
  | "developers"
  | "status"
  | "outro";

export interface SceneScript {
  id: SceneId;
  /** Duration used when no voiceover audio exists for the scene. */
  fallbackSeconds: number;
  vo: string;
  /** Short caption lines shown bottom-center, in order. Must join back into `vo`. */
  captions: string[];
}

export const SCRIPT: SceneScript[] = [
  {
    id: "hook",
    fallbackSeconds: 5,
    vo: "AI agents are starting to spend money.",
    captions: ["AI agents are starting to spend money."],
  },
  {
    id: "problem",
    fallbackSeconds: 8.5,
    vo: "They pay for data, APIs and compute on their own. But giving an agent a wallet means trusting it with everything inside.",
    captions: [
      "They pay for data, APIs and compute",
      "on their own.",
      "But giving an agent a wallet",
      "means trusting it with everything inside.",
    ],
  },
  {
    id: "intro",
    fallbackSeconds: 7,
    vo: "Zero Network fixes that. Programmable money for agents, on Solana.",
    captions: ["Zero Network fixes that.", "Programmable money for agents,", "on Solana."],
  },
  {
    id: "how",
    fallbackSeconds: 16,
    vo: "You fund a vault and set the rules: a cap per payment, a daily limit, approved recipients, and a kill switch. Your agent can pay, but only inside those rules. Enforced on-chain, not on trust.",
    captions: [
      "You fund a vault and set the rules:",
      "a cap per payment, a daily limit,",
      "approved recipients, and a kill switch.",
      "Your agent can pay,",
      "but only inside those rules.",
      "Enforced on-chain, not on trust.",
    ],
  },
  {
    id: "safety",
    fallbackSeconds: 7,
    vo: "If an agent is buggy or hijacked, the damage is capped. And you can pause it instantly.",
    captions: ["If an agent is buggy or hijacked,", "the damage is capped.", "And you can pause it instantly."],
  },
  {
    id: "developers",
    fallbackSeconds: 9,
    vo: "Developers add it in a few lines with the Zero SDK.",
    captions: ["Developers add it in a few lines", "with the Zero SDK."],
  },
  {
    id: "status",
    fallbackSeconds: 6,
    vo: "Live on Solana devnet today. Private payments are in development.",
    captions: ["Live on Solana devnet today.", "Private payments are in development."],
  },
  {
    id: "outro",
    fallbackSeconds: 5.5,
    vo: "Zero Network. Programmable money for agents.",
    captions: ["Zero Network.", "Programmable money for agents."],
  },
];

/** URL shown in the outro. */
export const OUTRO_URL = "zero.xyred.xyz";
