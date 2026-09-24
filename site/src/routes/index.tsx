import { createFileRoute } from "@tanstack/react-router";
import { XeroLanding } from "@/components/xero-landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XERO — Private Programmable Money on Solana" },
      { name: "description", content: "Private, programmable, and verifiable digital-dollar payments on Solana." },
      { property: "og:title", content: "XERO — Private Programmable Money on Solana" },
      { property: "og:description", content: "Move digital dollars privately, enforce spending rules, and authorize autonomous agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XeroLanding,
});
