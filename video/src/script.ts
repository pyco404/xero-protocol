// Single source of truth for the voiceover script. scripts/generate-vo.mjs reads this file
// to synthesize one audio file per scene; captions are derived from `captions`.

export type SceneId =
  | "hook"
  | "problem"
  | "intro"
  | "how"
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
    vo: "XERO fixes that. Programmable money for agents, on Solana.",
    captions: ["XERO fixes that.", "Programmable money for agents,", "on Solana."],
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
    id: "developers",
    fallbackSeconds: 9,
    vo: "Developers add it in a few lines with the XERO SDK.",
    captions: ["Developers add it in a few lines", "with the XERO SDK."],
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
    vo: "XERO. Programmable money for agents.",
    captions: ["XERO.", "Programmable money for agents."],
  },
];

/** Placeholder shown in the outro. Replace with the real URL before publishing. */
export const OUTRO_URL = "xero.example";
