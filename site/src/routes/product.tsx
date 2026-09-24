import { createFileRoute } from "@tanstack/react-router";
import { Footer, LiveDemo, Navbar, Problem } from "@/components/xero-landing";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "XERO — Product" },
      {
        name: "description",
        content: "Understand the problem XERO solves and how programmable policy checks payments.",
      },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <div className="pt-16">
        <Problem />
        <LiveDemo />
      </div>
      <Footer />
    </main>
  );
}
