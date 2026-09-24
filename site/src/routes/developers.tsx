import { createFileRoute } from "@tanstack/react-router";
import { Developers, FinalCta, Footer, Navbar, Security } from "@/components/xero-landing";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "XERO — Developers" },
      {
        name: "description",
        content: "Developer tools and API patterns for creating programmable, policy-aware payments.",
      },
    ],
  }),
  component: DevelopersPage,
});

function DevelopersPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        <Developers />
        <Security />
        <FinalCta />
      </div>
      <Footer />
    </main>
  );
}
