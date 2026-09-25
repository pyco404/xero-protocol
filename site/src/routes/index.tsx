import { createFileRoute } from "@tanstack/react-router";
import { Footer, Hero, Navbar, TrustStrip } from "@/components/zero-landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZERO — Programmable Money for Agents on Solana" },
      {
        name: "description",
        content:
          "Programmable, verifiable digital-dollar payments for agents on Solana. Privacy in development.",
      },
      { property: "og:title", content: "ZERO — Programmable Money for Agents on Solana" },
      {
        property: "og:description",
        content:
          "Enforce spending rules on digital dollars and authorize autonomous agents. Private payments in development.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MainPage,
});

function MainPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        <Hero />
        <TrustStrip />
      </div>
      <Footer />
    </main>
  );
}
