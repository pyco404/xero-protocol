import { createFileRoute } from "@tanstack/react-router";
import { Agents, Footer, Navbar, UseCases } from "@/components/zero-landing";

export const Route = createFileRoute("/use-cases")({
  head: () => ({
    meta: [
      { title: "ZERO — Use Cases" },
      {
        name: "description",
        content: "Explore the real-world use cases for programmable agent money and private payments.",
      },
    ],
  }),
  component: UseCasesPage,
});

function UseCasesPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        <Agents />
        <UseCases />
      </div>
      <Footer />
    </main>
  );
}
