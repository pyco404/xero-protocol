import { createFileRoute } from "@tanstack/react-router";
import { XeroLanding } from "@/components/xero-landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XERO — Programmable Money for Agents on Solana" },
      {
        name: "description",
        content:
          "Programmable, verifiable digital-dollar payments for agents on Solana. Privacy in development.",
      },
      { property: "og:title", content: "XERO — Programmable Money for Agents on Solana" },
      {
        property: "og:description",
        content:
          "Enforce spending rules on digital dollars and authorize autonomous agents. Private payments in development.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XeroLanding,
});
