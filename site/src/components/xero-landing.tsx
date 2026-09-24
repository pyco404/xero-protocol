import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Code2,
  Eye,
  Github,
  Globe,
  Hexagon,
  KeyRound,
  LockKeyhole,
  Menu,
  Network,
  ReceiptText,
  ShieldCheck,
  ShieldX,
  Terminal,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  ["Product", "#product"],
  ["Technology", "#technology"],
  ["Use Cases", "#use-cases"],
  ["Developers", "#developers"],
  ["Docs", "#developers"],
] as const;

// Example numbers used across the page: budget $100, daily limit $20, max payment $5, 8 providers.
const policies = [
  {
    id: "01",
    name: "Limits",
    icon: CircleDollarSign,
    title: "DAILY LIMIT",
    value: "$20.00",
    copy: "Payments above $5, or past the daily limit, are denied before they happen.",
  },
  {
    id: "02",
    name: "Allowlists",
    icon: Check,
    title: "APPROVED PROVIDERS",
    value: "8 providers",
    copy: "Restrict payments to approved services.",
  },
  {
    id: "03",
    name: "Recurring",
    icon: Clock3,
    title: "EVERY 30 DAYS",
    value: "$49.00",
    copy: "Authorize recurring payments without exposing activity.",
  },
  {
    id: "04",
    name: "Agents",
    icon: Bot,
    title: "AGENT BUDGET",
    value: "$100.00",
    copy: "Give agents funds with strict programmable boundaries.",
  },
] as const;

const securityPillars: ReadonlyArray<readonly [string, string, LucideIcon]> = [
  ["ZERO-KNOWLEDGE", "Prove a payment is valid without revealing its details.", KeyRound],
  ["ENCRYPTION", "Amounts and balances are encrypted, not just hidden in the UI.", LockKeyhole],
  [
    "ONCHAIN VERIFICATION",
    "Solana verifies every proof. No trusted operator decides.",
    ShieldCheck,
  ],
  ["PROGRAMMABLE POLICIES", "Spending rules are enforced before a payment is authorized.", Braces],
];

const layers = [
  ["USER / AGENT", "Initiates a payment request.", Bot],
  ["XERO WALLET", "Controls private funds.", WalletCards],
  ["POLICY ENGINE", "Defines what funds are allowed to do.", Braces],
  ["ZK PRIVACY LAYER", "Generates cryptographic proofs.", KeyRound],
  ["SOLANA", "Provides settlement and verification.", Zap],
  ["USDC", "Provides dollar-denominated value.", CircleDollarSign],
] as const;

function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <span className={`grid place-items-center border border-primary/60 bg-primary/5 ${className}`}>
      <span className="size-[36%] rotate-45 border border-primary" />
    </span>
  );
}

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="XERO home">
      <LogoMark />
      <span className="font-display text-[15px] font-semibold tracking-[0.22em]">XERO</span>
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
      {children}
    </p>
  );
}

function FlowLine({ className = "h-12" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative mx-auto w-px overflow-hidden bg-border ${className}`}>
      {!reduce && (
        <motion.span
          className="absolute inset-x-0 h-4 bg-primary"
          animate={{ top: ["-40%", "100%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || open ? "border-b border-border bg-background/85 backdrop-blur-xl" : "bg-transparent"}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {navItems.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" size="sm" asChild>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <Github />
              GitHub
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href="#demo">
              Launch App <ArrowRight />
            </a>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-background lg:hidden"
          >
            <div className="flex flex-col gap-1 px-5 py-5">
              {navItems.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="py-3 text-sm text-muted-foreground"
                >
                  {label}
                </a>
              ))}
              <Button className="mt-3" asChild>
                <a href="#demo" onClick={() => setOpen(false)}>
                  Launch App <ArrowRight />
                </a>
              </Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

// Sized in container-query units (cqw = 1% of the visual's width) so every part scales together.
// The width is also capped by viewport height so the hero stays within the fold on short screens.
function PrivateDollar() {
  return (
    <div className="@container relative mx-auto flex aspect-square w-full max-w-[min(640px,calc(88svh-10rem))] items-center justify-center lg:mr-0">
      <div className="absolute inset-[1.5cqw] border border-dashed border-border/70" />
      <div className="absolute left-[5cqw] top-[5cqw] font-mono text-[length:max(9px,1.7cqw)] text-muted-foreground">
        PROOF::0X7F3A
      </div>
      <div className="absolute bottom-[5cqw] right-[5cqw] font-mono text-[length:max(9px,1.7cqw)] text-muted-foreground">
        SETTLEMENT::SOL
      </div>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute aspect-square rounded-full border border-proof/30"
          style={{ width: `${60 + i * 16}cqw` }}
          animate={{ rotate: i % 2 ? -360 : 360 }}
          transition={{ duration: 22 + i * 8, repeat: Infinity, ease: "linear" }}
        >
          <span className="absolute left-1/2 top-0 size-[max(6px,1.1cqw)] -translate-y-1/2 rounded-full bg-proof shadow-proof" />
        </motion.div>
      ))}
      <div className="relative z-10 flex flex-col items-center gap-[4cqw]">
        <div className="w-[82cqw] border border-primary/40 bg-card p-[0.8cqw]">
          <div className="border border-border bg-background/80 px-[8cqw] py-[8.5cqw]">
            <div className="mb-[15cqw] flex items-center justify-between font-mono text-[length:max(9px,2.9cqw)] text-muted-foreground">
              <span>PRIVATE USD</span>
              <LockKeyhole className="size-[4.5cqw] text-primary" />
            </div>
            <div className="flex items-end justify-between">
              <span className="font-display text-[11.5cqw] font-semibold leading-none">XERO</span>
              <span className="font-mono text-[length:max(10px,3.2cqw)] text-primary">
                VERIFIED
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[1.6cqw] border border-border bg-card px-[2.6cqw] py-[1.6cqw] font-mono text-[length:max(9px,2.1cqw)]">
          <ShieldCheck className="size-[max(14px,3cqw)] text-primary" /> ZK PROOF{" "}
          <span className="text-primary">VALID</span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-[88svh] overflow-hidden border-b border-border pt-16"
    >
      <div className="protocol-grid absolute inset-0 opacity-35" />
      <div className="relative mx-auto grid min-h-[calc(88svh-4rem)] max-w-7xl items-center gap-6 px-5 py-14 lg:grid-cols-2 lg:gap-10 lg:px-8 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <p className="mb-7 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <span className="size-1.5 bg-primary shadow-mint" />
            Private programmable money
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-6xl xl:text-7xl 2xl:text-[5.25rem]">
            Money that can prove what it&apos;s allowed to do.
          </h1>
          <p className="mt-6 text-lg font-medium text-foreground/85">
            Private by design. Programmable by default. Built on Solana.
          </p>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">
            Move digital dollars without exposing your entire financial history. Define spending
            rules, authorize autonomous agents, and selectively prove what matters.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="#demo">
                Launch XERO <ArrowRight />
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#technology">Explore the Protocol</a>
            </Button>
          </div>
          <p className="mt-7 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            Solana <span className="mx-2 text-border">·</span> USDC{" "}
            <span className="mx-2 text-border">·</span> Zero-knowledge
          </p>
        </motion.div>
        <PrivateDollar />
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="border-b border-border bg-surface/40">
      <div className="mx-auto grid max-w-7xl grid-cols-2 border-x border-border sm:grid-cols-3 lg:grid-cols-5">
        {["SOLANA", "USDC", "ZERO-KNOWLEDGE", "NON-CUSTODIAL", "PROGRAMMABLE"].map((item, i) => (
          <div
            key={item}
            className={`flex h-20 items-center justify-center gap-2 border-border px-4 font-mono text-[9px] tracking-[0.16em] text-muted-foreground ${i < 4 ? "lg:border-r" : ""}`}
          >
            <Hexagon className="size-3.5 text-foreground/60" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  const exposed = ["Amount", "Balance", "Payment history", "Counterparties", "Spending patterns"];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const reduce = useReducedMotion();
  const [arrived, setArrived] = useState(false);
  const [shown, setShown] = useState(0);
  const visible = reduce ? exposed.length : shown;

  // Once the transfer lands, light up what an observer can read, one chip at a time.
  useEffect(() => {
    if (!arrived || shown >= exposed.length) return;
    const timer = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 250 : 380);
    return () => window.clearTimeout(timer);
  }, [arrived, shown, exposed.length]);

  return (
    <section id="product" className="section-shell">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>The problem</SectionLabel>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <Reveal>
            <h2 className="heading-lg">
              Blockchains made money programmable.{" "}
              <span className="block text-muted-foreground">They also made it public.</span>
            </h2>
          </Reveal>
          <Reveal className="relative border-y border-border py-8">
            <div ref={ref}>
              <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                <span>WALLET A</span>
                <span>TRANSFER</span>
                <span>WALLET B</span>
              </div>
              <div className="my-8 flex items-center gap-4">
                <span className="size-3 border border-foreground/60" />
                <div className="relative h-px flex-1 bg-border">
                  <div className="absolute inset-y-0 left-0 right-2">
                    <motion.span
                      className="absolute -top-1 size-2 bg-warning"
                      initial={{ left: reduce ? "100%" : "0%" }}
                      {...(inView && !reduce ? { animate: { left: "100%" } } : {})}
                      transition={{ duration: 2.4, ease: "easeInOut" }}
                      onAnimationComplete={() => setArrived(true)}
                    />
                  </div>
                </div>
                <span className="size-3 border border-foreground/60" />
              </div>
              <div className="mb-8 text-center font-mono text-sm text-warning">$4,250 USDC</div>
              <p
                className={`mb-3 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-warning transition-opacity duration-500 ${visible > 0 ? "opacity-100" : "opacity-0"}`}
              >
                <Eye className="size-3.5" /> VISIBLE TO ANYONE
              </p>
              <div className="flex flex-wrap gap-2">
                {exposed.map((item, index) => {
                  const on = index < visible;
                  return (
                    <div
                      key={item}
                      className={`border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-500 ${on ? "border-warning/60 bg-warning/10 text-warning" : "border-border bg-background text-muted-foreground/60"}`}
                    >
                      {item}
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal className="mt-14 max-w-3xl border-l border-primary pl-6 text-2xl leading-snug sm:text-3xl">
          What if the blockchain could verify the payment without seeing everything?
        </Reveal>
      </div>
    </section>
  );
}

function Solution() {
  const features = [
    ["PRIVATE", "Sensitive financial information can remain shielded.", LockKeyhole],
    ["VERIFIABLE", "The blockchain can verify cryptographic validity.", ShieldCheck],
    ["PROGRAMMABLE", "Rules determine what private money is allowed to do.", Braces],
  ] as const;
  return (
    <section id="technology" className="section-shell border-y border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>The XERO layer</SectionLabel>
        <Reveal>
          <h2 className="heading-xl max-w-4xl">
            Verify everything. <span className="text-primary">Reveal less.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <Reveal className="flex flex-col items-center">
            {["USDC", "XERO", "PRIVATE PAYMENT", "ZK PROOF", "SOLANA ✓"].map((item, index) => (
              <div key={item} className="contents">
                <div
                  className={`w-full max-w-sm border px-5 py-4 text-center font-mono text-[10px] tracking-[0.14em] ${index === 1 ? "border-primary bg-primary/5 text-primary shadow-mint" : "border-border bg-card"}`}
                >
                  {item}
                </div>
                {index < 4 && <FlowLine />}
              </div>
            ))}
          </Reveal>
          <div className="grid gap-px bg-border sm:grid-cols-3">
            {features.map(([title, copy, Icon]) => (
              <div key={title} className="bg-background">
                <Reveal className="min-h-56 p-7">
                  <Icon className="mb-12 size-5 text-primary" />
                  <h3 className="font-mono text-[10px] tracking-[0.15em]">{title}</h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{copy}</p>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PrivateVerifiable() {
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Private + verifiable</SectionLabel>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <h2 className="heading-xl">Privacy doesn&apos;t mean trust.</h2>
            <p className="mt-6 max-w-xl leading-7 text-muted-foreground">
              XERO uses cryptographic proofs so transactions can remain verifiable without exposing
              unnecessary financial information.
            </p>
          </Reveal>
          <Reveal className="grid gap-px bg-border sm:grid-cols-2">
            <div className="bg-card p-6">
              <p className="terminal-label">PUBLIC CHAIN</p>
              {[
                ["Transaction", "✓"],
                ["Proof", "✓"],
                ["Amount", "PRIVATE"],
                ["Balance", "PRIVATE"],
              ].map(([a, b]) => (
                <div
                  key={a}
                  className="flex justify-between border-b border-border py-4 font-mono text-[10px]"
                >
                  <span className="text-muted-foreground">{a}</span>
                  <span className="text-primary">{b}</span>
                </div>
              ))}
            </div>
            <div className="bg-card p-6">
              <p className="terminal-label">PRIVATE DATA</p>
              {["Amount", "Balance", "Payment details"].map((x) => (
                <div
                  key={x}
                  className="flex items-center gap-3 border-b border-border py-4 font-mono text-[10px] text-muted-foreground"
                >
                  <LockKeyhole className="size-3 text-proof" />
                  {x}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ProgrammableMoney() {
  const [active, setActive] = useState(0);
  const activePolicy = policies[active] ?? policies[0];
  return (
    <section className="section-shell border-y border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Programmable money</SectionLabel>
        <Reveal>
          <h2 className="heading-xl">Privacy is only the beginning.</h2>
          <p className="mt-5 text-xl text-muted-foreground sm:text-2xl">
            Private money becomes powerful when you can program it.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <div className="grid grid-cols-2 gap-px bg-border">
            {policies.map((policy, index) => (
              <button
                key={policy.name}
                onClick={() => setActive(index)}
                aria-pressed={active === index}
                className={`min-h-44 cursor-pointer p-5 text-left transition-colors ${active === index ? "bg-elevated shadow-[inset_0_0_0_1px_var(--primary)]" : "bg-background hover:bg-card"}`}
              >
                <span className="font-mono text-[9px] text-muted-foreground">{policy.id}</span>
                <policy.icon
                  className={`my-5 size-5 ${active === index ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="block text-sm font-medium">{policy.name}</span>
              </button>
            ))}
          </div>
          <div className="border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-border pb-5">
              <p className="terminal-label">XERO POLICY / {activePolicy.id}</p>
              <span className="status-dot">ACTIVE</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="py-10"
              >
                <p className="terminal-label">{activePolicy.title}</p>
                <p className="mt-3 font-mono text-3xl text-primary">{activePolicy.value}</p>
                <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
                  {activePolicy.copy}
                </p>
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6 font-mono text-[9px]">
              <span>PAYMENT REQUEST</span>
              <ArrowRight className="size-3 text-muted-foreground" />
              <span>POLICY CHECK</span>
              <ArrowRight className="size-3 text-muted-foreground" />
              <span className="text-primary">ALLOW ✓</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const agentNodes = [
  "AI AGENT",
  "XERO WALLET",
  "POLICY ENGINE",
  "ZK PRIVACY",
  "PRIVATE PAYMENT",
  "SOLANA",
];
const POLICY_NODE = 2;
const HOP_MS = 800;
const agentRequests = [
  { label: "$0.42 → data.api", allowed: true },
  { label: "$40.00 → unknown provider", allowed: false },
] as const;

type AgentFrame = { request: 0 | 1; node: number; outcome: "allow" | "deny" | null; ms: number };

const idleFrame: AgentFrame = { request: 0, node: -1, outcome: null, ms: 800 };

// One loop: an allowed request travels the full path, then a violation stops at the policy engine.
const agentTimeline: AgentFrame[] = [
  ...agentNodes.map((_, node) => ({ request: 0 as const, node, outcome: null, ms: HOP_MS })),
  { request: 0, node: agentNodes.length - 1, outcome: "allow", ms: 2800 },
  { request: 1, node: -1, outcome: null, ms: 800 },
  ...[0, 1, POLICY_NODE].map((node) => ({ request: 1 as const, node, outcome: null, ms: HOP_MS })),
  { request: 1, node: POLICY_NODE, outcome: "deny", ms: 3200 },
  idleFrame,
];

function AgentFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [frameIndex, setFrameIndex] = useState(0);
  const frame = agentTimeline[frameIndex] ?? idleFrame;
  const animated = !reduce;

  useEffect(() => {
    if (!animated || !inView) return;
    const timer = window.setTimeout(
      () => setFrameIndex((i) => (i + 1) % agentTimeline.length),
      frame.ms,
    );
    return () => window.clearTimeout(timer);
  }, [animated, inView, frameIndex, frame.ms]);

  const request = agentRequests[frame.request];
  const lastNode = request.allowed ? agentNodes.length - 1 : POLICY_NODE;
  const allowLit = !animated || frame.outcome === "allow";
  const denyLit = !animated || frame.outcome === "deny";

  const nodeClass = (index: number) => {
    if (animated && frame.outcome === "deny" && index === POLICY_NODE)
      return "border-error bg-error/10 text-error";
    if (animated && index === frame.node) return "border-primary bg-primary/10 text-primary";
    if (animated && index < frame.node) return "border-primary/40 bg-background text-foreground";
    if (index === POLICY_NODE) return "border-proof/60 bg-proof/5 text-proof";
    return "border-border bg-background";
  };

  return (
    <div ref={ref} className="relative border border-border bg-card p-6 sm:p-10">
      <div className="protocol-grid absolute inset-0 opacity-20" />
      <div className="relative mb-6 flex h-5 items-center justify-center font-mono text-[10px] tracking-[0.12em]">
        {animated && (
          <AnimatePresence mode="wait">
            <motion.span
              key={frame.request}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-muted-foreground"
            >
              REQUEST 0{frame.request + 1} ·{" "}
              <span className={request.allowed ? "text-foreground" : "text-error"}>
                {request.label}
              </span>
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      <div className="relative flex flex-col items-center">
        {agentNodes.map((item, index) => {
          const hopping =
            animated && frame.outcome === null && frame.node === index && index < lastNode;
          return (
            <div className="contents" key={item}>
              <motion.div
                animate={
                  animated && frame.outcome === "deny" && index === POLICY_NODE
                    ? { opacity: [1, 0.45, 1, 0.45, 1] }
                    : { opacity: 1 }
                }
                transition={{ duration: 1.2 }}
                className={`w-full max-w-xs border px-5 py-3 text-center font-mono text-[9px] tracking-[0.14em] transition-colors duration-300 ${nodeClass(index)}`}
              >
                {item}
              </motion.div>
              {index < agentNodes.length - 1 && (
                <div className="relative h-10 w-px bg-border">
                  {hopping && (
                    <motion.span
                      key={frameIndex}
                      className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-primary shadow-mint"
                      initial={{ top: "-4px", opacity: 0 }}
                      animate={{ top: "calc(100% - 4px)", opacity: 1 }}
                      transition={{ duration: (HOP_MS - 100) / 1000, ease: "easeInOut" }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative mt-8 grid grid-cols-2 gap-3">
        <div
          className={`border p-4 font-mono text-[9px] transition-all duration-500 ${allowLit ? "border-primary/70 bg-primary/10" : "border-border bg-background opacity-50"}`}
        >
          <span className="text-primary">✓ ALLOW</span>
          <p className="mt-2 text-muted-foreground">
            {allowLit ? "$0.42 → data.api · settled" : "AUTHORIZED REQUEST"}
          </p>
        </div>
        <div
          className={`border p-4 font-mono text-[9px] transition-all duration-500 ${denyLit ? "border-error/70 bg-error/10" : "border-border bg-background opacity-50"}`}
        >
          <span className="text-error">✕ DENIED</span>
          <p className="mt-2 text-muted-foreground">
            {denyLit ? "Recipient not allowed" : "POLICY VIOLATION"}
          </p>
        </div>
      </div>
    </div>
  );
}

function Agents() {
  return (
    <section className="section-shell overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Autonomous payments</SectionLabel>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <h2 className="heading-lg">Give agents money without giving them unlimited power.</h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Autonomous agents need wallets. Wallets need boundaries.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-px bg-border">
              {[
                ["BUDGET", "$100"],
                ["DAILY LIMIT", "$20"],
                ["MAX PAYMENT", "$5"],
                ["APPROVED PROVIDERS", "8"],
              ].map(([a, b]) => (
                <div className="bg-background p-4" key={a}>
                  <p className="terminal-label">{a}</p>
                  <p className="mt-2 font-mono text-lg text-foreground">{b}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal>
            <AgentFlow />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const demoSteps = [
  "Provider allowed",
  "Amount within limit",
  "Agent authorized",
  "ZK proof generated",
  "Transaction verified",
  "Payment settled",
];

type StepResult = "pass" | "fail" | "skip";
type Scenario = "valid" | "violation";

const scenarios: Record<
  Scenario,
  { provider: string; amount: string; results: StepResult[]; lastStep: number; reason?: string }
> = {
  valid: {
    provider: "data.api",
    amount: "$0.42",
    results: ["pass", "pass", "pass", "pass", "pass", "pass"],
    lastStep: 5,
  },
  violation: {
    provider: "unknown.api",
    amount: "$40.00",
    // The program checks the allowlist before the amount, so the first failure ends the run.
    results: ["fail", "skip", "skip", "skip", "skip", "skip"],
    lastStep: 0,
    reason: "Recipient not allowed",
  },
};

function LiveDemo() {
  const reduce = useReducedMotion();
  const [scenario, setScenario] = useState<Scenario>("valid");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const current = scenarios[scenario];
  const denied = scenario === "violation";
  const done = !running && step === demoSteps.length - 1;

  useEffect(() => {
    if (!running) return;
    const checking = step < current.lastStep;
    const timer = window.setTimeout(
      () => {
        if (checking) return setStep((s) => s + 1);
        // A failed check skips everything after it; nothing reaches the chain.
        setStep(demoSteps.length - 1);
        setRunning(false);
      },
      checking ? 520 : 400,
    );
    return () => window.clearTimeout(timer);
  }, [running, step, current.lastStep]);

  const run = (next: Scenario) => {
    setScenario(next);
    setStep(-1);
    setRunning(true);
  };

  const publicRows: [string, string, string][] = denied
    ? [
        [
          "TRANSACTION",
          step >= current.lastStep ? "NONE" : "—",
          step >= current.lastStep ? "text-error" : "",
        ],
        ["AMOUNT", "—", ""],
        ["BALANCE", "—", ""],
        ["POLICY", "—", ""],
      ]
    : [
        ["TRANSACTION", step >= 4 ? "VERIFIED" : "PENDING", step >= 4 ? "text-primary" : ""],
        ["AMOUNT", "PRIVATE", "text-proof"],
        ["BALANCE", "PRIVATE", "text-proof"],
        ["POLICY", step >= 1 ? "VALID" : "—", step >= 1 ? "text-primary" : ""],
      ];

  return (
    <section id="demo" className="section-shell border-y border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Payment simulation</SectionLabel>
        <Reveal>
          <h2 className="heading-xl">Watch a private payment happen.</h2>
        </Reveal>
        <div className="mt-12 grid overflow-hidden border border-border bg-background lg:grid-cols-[1.25fr_.75fr]">
          <div className="border-b border-border p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="mb-6 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-foreground">
              <Eye className="size-4 text-primary" /> WHAT THE AGENT SEES
            </p>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Terminal className="size-4 text-primary" />
                <div>
                  <p className="terminal-label">XERO AGENT</p>
                  <p className="mt-1 font-mono text-xs">research-agent-01</p>
                </div>
              </div>
              <span className="status-dot">SANDBOX</span>
            </div>
            <div className="border border-border bg-card p-5 font-mono text-[11px]">
              <p className="text-muted-foreground">REQUEST</p>
              <div className="my-4 h-px bg-border" />
              <div className="grid grid-cols-[90px_1fr] items-center gap-y-3">
                <span className="text-muted-foreground">Provider</span>
                <span className={denied ? "text-error" : ""}>{current.provider}</span>
                <span className="text-muted-foreground">Amount</span>
                <span className={`text-base ${denied ? "text-error" : "text-foreground"}`}>
                  {current.amount}
                </span>
                <span className="text-muted-foreground">Policy</span>
                <span>agent-default</span>
              </div>
            </div>
            <div className="mt-6 min-h-[218px] space-y-3">
              {demoSteps.map((item, index) => {
                const result = index <= step ? current.results[index] : undefined;
                return (
                  <motion.div
                    key={item}
                    animate={{ opacity: result ? 1 : 0.25, x: result ? 0 : -4 }}
                    className={`flex items-center gap-3 font-mono text-[10px] ${result === "fail" ? "text-error" : result === "skip" ? "text-muted-foreground" : ""}`}
                  >
                    <span
                      className={`grid size-5 place-items-center border ${result === "pass" ? "border-primary/50 bg-primary/5 text-primary" : result === "fail" ? "border-error/60 bg-error/10 text-error" : "border-border text-muted-foreground"}`}
                    >
                      {result === "pass" ? (
                        <Check className="size-3" />
                      ) : result === "fail" ? (
                        <X className="size-3" />
                      ) : result === "skip" ? (
                        "—"
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span className={result === "skip" ? "line-through" : ""}>{item}</span>
                    {result === "skip" && <span className="text-[9px]">SKIPPED</span>}
                  </motion.div>
                );
              })}
            </div>
            <AnimatePresence>
              {done && (
                <motion.p
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-4 border px-4 py-3 font-mono text-[10px] ${denied ? "border-error/60 bg-error/10 text-error" : "border-primary/40 bg-primary/5 text-primary"}`}
                >
                  {denied
                    ? `DENIED: ${current.reason}. No transaction created.`
                    : "PAYMENT SETTLED. Amount and balance stayed private."}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => run("valid")} disabled={running}>
                {running && !denied ? "Processing…" : done && !denied ? "Run Again" : "Run Demo"}
                <ArrowRight />
              </Button>
              <Button variant="outline" onClick={() => run("violation")} disabled={running}>
                {running && denied ? "Processing…" : "Try a violation"}
              </Button>
            </div>
          </div>
          <div className="flex flex-col bg-card p-5 sm:p-8">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-foreground">
              <Globe className="size-4 text-proof" /> WHAT THE CHAIN SEES
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              The public record on Solana. Anyone can read it.
            </p>
            <div className="mt-6">
              {publicRows.map(([label, value, tone]) => (
                <div
                  key={label}
                  className={`flex items-center justify-between border-b border-border py-5 font-mono ${label === "AMOUNT" ? "text-sm" : "text-[10px]"}`}
                >
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  <span className={`flex items-center gap-2 ${tone || "text-foreground"}`}>
                    {value === "PRIVATE" && <LockKeyhole className="size-3" />}
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-8 flex min-h-44 flex-1 items-center justify-center border border-dashed border-border">
              {done && denied ? (
                <div className="grid size-24 place-items-center rounded-full border border-error/60">
                  <ShieldX className="size-8 text-error" />
                </div>
              ) : (
                <motion.div
                  key={step >= 3 ? "proven" : "idle"}
                  animate={step >= 3 && !denied && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`grid size-24 place-items-center rounded-full border ${step >= 3 && !denied ? "border-primary/60" : "border-border"}`}
                >
                  <ShieldCheck
                    className={`size-8 ${step >= 3 && !denied ? "text-primary" : "text-muted-foreground"}`}
                  />
                </motion.div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 font-mono text-[8px] text-muted-foreground">
          SIMULATION ONLY · NO BLOCKCHAIN TRANSACTION IS CREATED
        </p>
      </div>
    </section>
  );
}

type TxField = "sender" | "recipient" | "amount" | "balance";

const disclosureLevels: { name: string; hides: TxField[]; research?: boolean }[] = [
  { name: "PUBLIC", hides: [] },
  { name: "AMOUNT PRIVATE", hides: ["amount"] },
  { name: "BALANCE PRIVATE", hides: ["amount", "balance"] },
  { name: "COUNTERPARTY PRIVATE", hides: ["amount", "balance", "recipient"], research: true },
  {
    name: "FULLY SHIELDED",
    hides: ["amount", "balance", "recipient", "sender"],
    research: true,
  },
];

const txPreview: [TxField, string, string][] = [
  ["sender", "Sender", "7xQm…9fKa"],
  ["recipient", "Recipient", "vendor.sol"],
  ["amount", "Amount", "$4,250.00 USDC"],
  ["balance", "Balance", "$18,420.55"],
];

function Disclosure() {
  const [level, setLevel] = useState(2);
  const hidden = disclosureLevels[level]?.hides ?? [];
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Selective disclosure</SectionLabel>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-x-14">
          <Reveal>
            <h2 className="heading-lg">Privacy without losing trust.</h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Prove what matters. Reveal only what you choose.
            </p>
          </Reveal>
          <Reveal className="lg:row-span-2">
            <div className="space-y-2">
              {disclosureLevels.map((item, index) => (
                <button
                  key={item.name}
                  onClick={() => setLevel(index)}
                  aria-pressed={index === level}
                  className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 border px-4 py-3 text-left font-mono text-[10px] transition-colors ${index === level ? "border-primary bg-elevated text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="flex items-center gap-2">
                    {String(index + 1).padStart(2, "0")} / {item.name}
                    {item.research && (
                      <span className="border border-border px-1.5 py-px text-[8px] tracking-[0.12em] text-muted-foreground">
                        RESEARCH
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {item.hides.length === 0 ? (
                      <span className="text-[9px] text-muted-foreground">NOTHING HIDDEN</span>
                    ) : (
                      item.hides.map((field) => (
                        <span
                          key={field}
                          className="flex items-center gap-1 border border-proof/30 px-1.5 py-px text-[8px] uppercase text-proof"
                        >
                          <LockKeyhole className="size-2.5" />
                          {field}
                        </span>
                      ))
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-px bg-border">
              {[
                "Sufficient funds",
                "Payment authorized",
                "Policy satisfied",
                "Payroll completed",
              ].map((x) => (
                <div key={x} className="flex items-center gap-2 bg-card p-4 font-mono text-[9px]">
                  <Check className="size-3 text-primary" />
                  {x}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="border border-border bg-card p-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <p className="terminal-label">PUBLIC VIEW OF A PAYMENT</p>
              <span className="font-mono text-[9px] text-primary">
                LEVEL {String(level + 1).padStart(2, "0")}
              </span>
            </div>
            {txPreview.map(([field, label, value]) => {
              const masked = hidden.includes(field);
              return (
                <div
                  key={field}
                  className="flex items-center justify-between border-b border-border py-3 font-mono text-[11px] last:border-b-0"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={masked ? "masked" : "shown"}
                      initial={{ opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-center gap-2 ${masked ? "text-proof" : "text-foreground"}`}
                    >
                      {masked && <LockKeyhole className="size-3" />}
                      {masked ? "••••••••" : value}
                    </motion.span>
                  </AnimatePresence>
                </div>
              );
            })}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    [
      "AI AGENTS",
      "Private autonomous spending.",
      "Agents pay APIs, compute services, data providers, and other agents within programmable policies.",
      Bot,
    ],
    [
      "BUSINESSES",
      "Private treasury and vendor payments.",
      "Move business funds without exposing the company’s complete payment history.",
      Network,
    ],
    [
      "PAYROLL",
      "Private salary distribution.",
      "Enable programmable payroll while minimizing public financial exposure.",
      WalletCards,
    ],
    [
      "SUBSCRIPTIONS",
      "Private recurring payments.",
      "Authorize recurring payments without broadcasting unnecessary financial information.",
      ReceiptText,
    ],
  ] as const;
  return (
    <section id="use-cases" className="section-shell border-y border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Use cases</SectionLabel>
        <Reveal>
          <h2 className="heading-xl max-w-4xl">Built for money that shouldn&apos;t be public.</h2>
        </Reveal>
        <div className="mt-12 grid gap-px bg-border md:grid-cols-2">
          {cases.map(([title, subtitle, copy, Icon], i) => (
            // The cell keeps its background while the content animates in, so the grid's
            // border color never shows through as a gray block.
            <div key={title} className="bg-background">
              <Reveal className="group p-7 sm:p-8">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[9px] text-muted-foreground">0{i + 1}</span>
                  <Icon className="size-5 text-primary transition-transform group-hover:scale-110" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-foreground/80">{subtitle}</p>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{copy}</p>
              </Reveal>
            </div>
          ))}
        </div>
        <div className="mt-px flex flex-wrap gap-px bg-border">
          {[
            "PRIVATE INVOICES",
            "MERCHANT PAYMENTS",
            "AGENT-TO-AGENT",
            "TREASURY MANAGEMENT",
            "API PAYMENTS",
            "PRIVATE TRADING",
          ].map((x) => (
            <span
              key={x}
              className="flex-1 whitespace-nowrap bg-background px-5 py-4 text-center font-mono text-xs tracking-[0.06em] text-foreground/75"
            >
              {x}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  const [active, setActive] = useState(0);
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Architecture</SectionLabel>
        <div className="grid gap-14 lg:grid-cols-[.9fr_1.1fr]">
          <Reveal>
            <h2 className="heading-lg">A privacy layer for programmable money.</h2>
            <p className="mt-6 leading-7 text-muted-foreground">
              Each layer has one job. Together, they move dollar-denominated value with private,
              enforceable rules.
            </p>
          </Reveal>
          <Reveal>
            {layers.map(([title, copy, Icon], index) => (
              <div key={title} className="contents">
                {index > 0 && <FlowLine className="h-5" />}
                <button
                  onClick={() => setActive(index)}
                  aria-expanded={active === index}
                  className={`group flex w-full cursor-pointer items-center gap-4 border px-5 py-4 text-left transition-colors ${active === index ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground"}`}
                >
                  <Icon
                    className={`size-4 shrink-0 ${active === index ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="font-mono text-[9px] tracking-[0.12em]">{title}</span>
                  <span
                    className={`ml-auto hidden text-right text-xs sm:block ${active === index ? "text-foreground/85" : "text-muted-foreground"}`}
                  >
                    {copy}
                  </span>
                  <ChevronDown
                    className={`ml-auto size-3 transition-transform sm:hidden ${active === index ? "rotate-180 text-primary" : "text-muted-foreground"}`}
                  />
                </button>
                {active === index && (
                  <p className="border-x border-b border-primary/40 px-5 py-4 text-xs text-muted-foreground sm:hidden">
                    {copy}
                  </p>
                )}
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const codeSample = `const spender = await xero.createSpender({
  spender: agentWallet.publicKey,
  mint: usdc,
  deposit: "100",
  maxPerPayment: "5",
  dailyLimit: "20",
  allowedProviders: [dataApi, computeApi]
})

const agent = spender.as(agentWallet)
const result = await agent.pay({
  recipient: dataApi,
  amount: "0.42"
})
// result.status === "settled"
// result.remainingToday.decimal === "19.58"

await agent.pay({ recipient: unknownApi, amount: "40" })
// throws PolicyViolation: RecipientNotAllowed`;

const codeTokens: [RegExp, string][] = [
  [/^\/\/.*/, "text-muted-foreground/70"],
  [/^"[^"]*"/, "text-code"],
  [/^\b(const|await)\b/, "text-proof"],
  [/^\b\d+(\.\d+)?\b/, "text-primary"],
];

// Minimal highlighter for the fixed sample above; not a general-purpose tokenizer.
function highlight(source: string) {
  const out: React.ReactNode[] = [];
  let rest = source;
  let plain = "";
  while (rest) {
    const match = codeTokens
      .map(([re, cls]) => [re.exec(rest)?.[0], cls] as const)
      .find(([text]) => text);
    if (match?.[0]) {
      if (plain) out.push(plain);
      plain = "";
      out.push(
        <span key={out.length} className={match[1]}>
          {match[0]}
        </span>,
      );
      rest = rest.slice(match[0].length);
    } else {
      const skip = /^\w+/.exec(rest)?.[0] ?? rest.charAt(0);
      plain += skip;
      rest = rest.slice(skip.length);
    }
  }
  if (plain) out.push(plain);
  return out;
}

function Developers() {
  return (
    <section id="developers" className="section-shell border-y border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Developer experience</SectionLabel>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <h2 className="heading-xl">One API for private money.</h2>
            <p className="mt-6 max-w-lg leading-7 text-muted-foreground">
              Build wallets, agents, subscriptions, payroll, and private payment applications on
              XERO.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <a href="#developers">
                  Read the Docs <ArrowRight />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://github.com" target="_blank" rel="noreferrer">
                  <Github /> View GitHub
                </a>
              </Button>
            </div>
          </Reveal>
          <Reveal>
            <div className="overflow-hidden border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="font-mono text-[9px] text-muted-foreground">agent.ts</span>
                <Code2 className="size-3 text-primary" />
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-6 text-foreground/80 sm:p-7">
                <code>{highlight(codeSample)}</code>
              </pre>
            </div>
            <p className="mt-3 font-mono text-[9px] tracking-[0.08em] text-muted-foreground">
              Illustrative API. SDK in development.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>Security</SectionLabel>
        <Reveal>
          <h2 className="heading-xl">Cryptography, not promises.</h2>
        </Reveal>
        <div className="mt-12 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {securityPillars.map(([title, copy, SecurityIcon]) => (
            <div key={title} className="bg-background">
              <Reveal className="min-h-48 p-6">
                <SecurityIcon className="size-5 text-primary" />
                <p className="mt-12 font-mono text-[9px] tracking-[0.12em]">{title}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
              </Reveal>
            </div>
          ))}
        </div>
        <div className="mt-10 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
          {[
            "Non-custodial architecture",
            "Cryptographic verification",
            "Open-source protocol rules",
            "Security-first development",
            "Independent audits before production",
          ].map((x) => (
            <p key={x} className="flex gap-2">
              <Check className="mt-0.5 size-3 shrink-0 text-primary" />
              {x}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-y border-border py-20 sm:py-28">
      <div className="protocol-grid absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <Reveal>
          <LogoMark className="mx-auto mb-8 size-10" />
          <h2 className="font-display text-4xl font-semibold leading-tight text-balance sm:text-6xl">
            Your money shouldn&apos;t have to explain itself.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Build payments that are private, programmable, and verifiable.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="#demo">
                Launch XERO <ArrowRight />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#developers">
                Read the Docs <ArrowRight />
              </a>
            </Button>
          </div>
          <p className="mt-10 font-mono text-[9px] tracking-[0.18em] text-muted-foreground">
            BUILT ON SOLANA · POWERED BY CRYPTOGRAPHY
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// Items without an href have no page yet and render as muted "Soon" entries.
const footerColumns: Record<string, { label: string; href?: string }[]> = {
  PRODUCT: [
    { label: "App" },
    { label: "Technology", href: "#technology" },
    { label: "Use Cases", href: "#use-cases" },
    { label: "Roadmap" },
  ],
  DEVELOPERS: [{ label: "Docs" }, { label: "SDK" }, { label: "API" }, { label: "GitHub" }],
  COMMUNITY: [{ label: "X" }, { label: "Discord" }, { label: "Telegram" }],
  LEGAL: [{ label: "Privacy" }, { label: "Terms" }],
};

function Footer() {
  return (
    <footer className="px-5 py-14 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-10 border-b border-border pb-14 sm:grid-cols-4 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:gap-12">
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <Logo />
            <p className="mt-5 max-w-xs text-sm text-muted-foreground">
              Private programmable money on Solana.
            </p>
          </div>
          {Object.entries(footerColumns).map(([title, items]) => (
            <div key={title}>
              <p className="terminal-label">{title}</p>
              <div className="mt-5 space-y-3">
                {items.map(({ label, href }) =>
                  href ? (
                    <a
                      key={label}
                      href={href}
                      className="block text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </a>
                  ) : (
                    <span
                      key={label}
                      className="flex items-center gap-2 text-xs text-muted-foreground/50"
                    >
                      {label}
                      <span className="border border-border px-1 font-mono text-[8px] tracking-[0.1em]">
                        SOON
                      </span>
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pt-6 font-mono text-[8px] tracking-[0.14em] text-muted-foreground sm:flex-row sm:justify-between">
          <span>© 2026 XERO</span>
          <span>BUILT ON SOLANA</span>
        </div>
      </div>
    </footer>
  );
}

export function XeroLanding() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      <Hero />
      <TrustStrip />
      <Problem />
      <Solution />
      <PrivateVerifiable />
      <ProgrammableMoney />
      <Agents />
      <LiveDemo />
      <Disclosure />
      <UseCases />
      <Architecture />
      <Developers />
      <Security />
      <FinalCta />
      <Footer />
    </main>
  );
}
