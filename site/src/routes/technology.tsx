import { createFileRoute } from "@tanstack/react-router";
import {
  Architecture,
  Footer,
  Navbar,
  PrivateVerifiable,
  ProgrammableMoney,
  Security,
  Solution,
} from "@/components/zero-landing";

export const Route = createFileRoute("/technology")({
  head: () => ({
    meta: [
      { title: "ZERO — Technology" },
      {
        name: "description",
        content: "Privacy-first payment verification with programmable policy enforcement on Solana.",
      },
    ],
  }),
  component: TechnologyPage,
});

function TechnologyPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        <Solution />
        <PrivateVerifiable />
        <ProgrammableMoney />
        <Architecture />
        <Security />
      </div>
      <Footer />
    </main>
  );
}
