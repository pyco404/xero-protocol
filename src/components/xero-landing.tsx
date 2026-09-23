import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Code2,
  Github,
  Hexagon,
  KeyRound,
  LockKeyhole,
  Menu,
  Network,
  Power,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Terminal,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  ["Product", "#product"],
  ["Technology", "#technology"],
  ["Use Cases", "#use-cases"],
  ["Developers", "#developers"],
  ["Docs", "#developers"],
] as const;

const demoSteps = [
  "Provider allowed",
  "Amount within limit",
  "Agent authorized",
  "ZK proof generated",
  "Transaction verified",
  "Payment settled",
];

const policies = [
  { id: "01", name: "Limits", icon: CircleDollarSign, title: "DAILY LIMIT", value: "$100.00", copy: "Funds cannot exceed the defined spending policy." },
  { id: "02", name: "Allowlists", icon: Check, title: "APPROVED PROVIDERS", value: "8 verified", copy: "Restrict payments to approved services." },
  { id: "03", name: "Recurring", icon: Clock3, title: "EVERY 30 DAYS", value: "$49.00", copy: "Authorize recurring payments without exposing activity." },
  { id: "04", name: "Agents", icon: Bot, title: "AI AGENT", value: "Active", copy: "Give agents funds with strict programmable boundaries." },
] as const;

const layers = [
  ["XERO WALLET", "Controls private funds.", WalletCards],
  ["POLICY ENGINE", "Defines what funds are allowed to do.", Braces],
  ["ZK PRIVACY LAYER", "Generates cryptographic proofs.", KeyRound],
  ["SOLANA", "Provides settlement and verification.", Zap],
  ["USDC", "Provides dollar-denominated value.", CircleDollarSign],
] as const;

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="XERO home">
      <span className="grid size-7 place-items-center border border-primary/60 bg-primary/5">
        <span className="h-2.5 w-2.5 rotate-45 border border-primary" />
      </span>
      <span className="font-display text-[15px] font-semibold tracking-[0.22em]">XERO</span>
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">{children}</p>;
}

function FlowLine({ active = true }: { active?: boolean }) {
  return (
    <div className="relative h-12 w-px overflow-hidden bg-border">
      {active && <motion.span className="absolute inset-x-0 h-4 bg-primary" animate={{ y: [-18, 56] }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }} />}
    </div>
  );
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
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
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || open ? "border-b border-border bg-background/85 backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {navItems.map(([label, href]) => <a key={label} href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{label}</a>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" size="sm" asChild><a href="https://github.com" target="_blank" rel="noreferrer"><Github />GitHub</a></Button>
          <Button size="sm" asChild><a href="#demo">Launch App <ArrowRight /></a></Button>
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border bg-background lg:hidden">
            <div className="flex flex-col gap-1 px-5 py-5">
              {navItems.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)} className="py-3 text-sm text-muted-foreground">{label}</a>)}
              <Button className="mt-3" asChild><a href="#demo" onClick={() => setOpen(false)}>Launch App <ArrowRight /></a></Button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function PrivateDollar() {
  return (
    <div className="relative mx-auto flex h-[410px] w-full max-w-[560px] items-center justify-center lg:h-[520px]">
      <div className="absolute inset-10 border border-dashed border-border/70" />
      <div className="absolute left-6 top-12 font-mono text-[9px] text-muted-foreground">PROOF::0X7F3A</div>
      <div className="absolute bottom-14 right-4 font-mono text-[9px] text-muted-foreground">SETTLEMENT::SOL</div>
      {[0, 1, 2].map((i) => (
        <motion.div key={i} className="absolute rounded-full border border-proof/30" style={{ width: 190 + i * 72, height: 190 + i * 72 }} animate={{ rotate: i % 2 ? -360 : 360 }} transition={{ duration: 22 + i * 8, repeat: Infinity, ease: "linear" }}>
          <span className="absolute left-1/2 top-[-3px] size-1.5 rounded-full bg-proof shadow-proof" />
        </motion.div>
      ))}
      <motion.div className="absolute h-64 w-64 rounded-full bg-primary/8 blur-3xl" animate={{ scale: [0.9, 1.12, 0.9], opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 5, repeat: Infinity }} />
      <div className="relative z-10 w-64 border border-primary/40 bg-card p-1 shadow-mint">
        <div className="border border-border bg-background/80 px-7 py-8">
          <div className="mb-14 flex items-center justify-between font-mono text-[9px] text-muted-foreground"><span>PRIVATE USD</span><LockKeyhole className="size-3.5 text-primary" /></div>
          <div className="flex items-end justify-between"><span className="font-display text-4xl font-semibold">XERO</span><span className="font-mono text-[10px] text-primary">VERIFIED</span></div>
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-border bg-card px-3 py-2 font-mono text-[9px]"><ShieldCheck className="size-3.5 text-primary" /> ZK PROOF <span className="text-primary">VALID</span></div>
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="relative min-h-[88svh] overflow-hidden border-b border-border pt-16">
      <div className="protocol-grid absolute inset-0 opacity-35" />
      <div className="relative mx-auto grid min-h-[calc(88svh-4rem)] max-w-7xl items-center gap-6 px-5 py-14 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-10">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-3xl">
          <p className="mb-7 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"><span className="size-1.5 bg-primary shadow-mint" />Private programmable money</p>
          <h1 className="font-display text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl xl:text-[5.25rem]">Money that can prove what it&apos;s allowed to do.</h1>
          <p className="mt-7 text-lg font-medium text-foreground/85">Private by design. Programmable by default. Built on Solana.</p>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">Move digital dollars without exposing your entire financial history. Define spending rules, authorize autonomous agents, and selectively prove what matters.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild><a href="#demo">Launch XERO <ArrowRight /></a></Button>
            <Button variant="outline" size="lg" asChild><a href="#technology">Explore the Protocol</a></Button>
          </div>
          <p className="mt-8 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Solana <span className="mx-2 text-border">·</span> USDC <span className="mx-2 text-border">·</span> Zero-knowledge</p>
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
          <div key={item} className={`flex h-20 items-center justify-center gap-2 border-border px-4 font-mono text-[9px] tracking-[0.16em] text-muted-foreground ${i < 4 ? "lg:border-r" : ""}`}>
            <Hexagon className="size-3.5 text-foreground/60" />{item}
          </div>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  const exposed = ["$4,250", "Balance", "Payment history", "Counterparties", "Spending patterns"];
  return (
    <section id="product" className="section-shell">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>04 / The problem</SectionLabel>
        <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
          <Reveal><h2 className="heading-xl">Blockchains made money programmable. <span className="text-muted-foreground">They also made it public.</span></h2></Reveal>
          <Reveal className="relative border-y border-border py-8">
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground"><span>WALLET A</span><span>TRANSFER</span><span>WALLET B</span></div>
            <div className="my-8 flex items-center gap-4"><span className="size-3 border border-foreground/60" /><div className="relative h-px flex-1 bg-border"><motion.span className="absolute -top-1 size-2 bg-warning" animate={{ left: ["0%", "98%"] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} /></div><span className="size-3 border border-foreground/60" /></div>
            <div className="mb-8 text-center font-mono text-sm text-warning">$4,250 USDC</div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
              {exposed.map((item) => <div key={item} className="bg-background p-3 text-center font-mono text-[8px] uppercase text-error/80">{item}</div>)}
            </div>
          </Reveal>
        </div>
        <Reveal className="mt-20 max-w-3xl border-l border-primary pl-6 text-2xl leading-snug sm:text-3xl">What if the blockchain could verify the payment without seeing everything?</Reveal>
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
        <SectionLabel>05 / The XERO layer</SectionLabel>
        <Reveal><h2 className="heading-xl max-w-4xl">Verify everything. <span className="text-primary">Reveal less.</span></h2></Reveal>
        <div className="mt-16 grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <Reveal className="flex flex-col items-center">
            {["USDC", "XERO", "PRIVATE PAYMENT", "ZK PROOF", "SOLANA ✓"].map((item, index) => <div key={item} className="contents"><div className={`w-full max-w-sm border px-5 py-4 text-center font-mono text-[10px] tracking-[0.14em] ${index === 1 ? "border-primary bg-primary/5 text-primary shadow-mint" : "border-border bg-card"}`}>{item}</div>{index < 4 && <FlowLine />}</div>)}
          </Reveal>
          <div className="grid gap-px bg-border sm:grid-cols-3">
            {features.map(([title, copy, Icon]) => <Reveal key={title} className="min-h-56 bg-background p-7"><Icon className="mb-12 size-5 text-primary" /><h3 className="font-mono text-[10px] tracking-[0.15em]">{title}</h3><p className="mt-4 text-sm leading-6 text-muted-foreground">{copy}</p></Reveal>)}
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
        <SectionLabel>06 / Private + verifiable</SectionLabel>
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
          <Reveal><h2 className="heading-xl">Privacy doesn&apos;t mean trust.</h2><p className="mt-6 max-w-xl leading-7 text-muted-foreground">XERO uses cryptographic proofs so transactions can remain verifiable without exposing unnecessary financial information.</p></Reveal>
          <Reveal className="grid gap-px bg-border sm:grid-cols-2">
            <div className="bg-card p-6"><p className="terminal-label">PUBLIC CHAIN</p>{[["Transaction", "✓"], ["Proof", "✓"], ["Amount", "PRIVATE"], ["Balance", "PRIVATE"]].map(([a,b]) => <div key={a} className="flex justify-between border-b border-border py-4 font-mono text-[10px]"><span className="text-muted-foreground">{a}</span><span className="text-primary">{b}</span></div>)}</div>
            <div className="bg-card p-6"><p className="terminal-label">PRIVATE DATA</p>{["Amount", "Balance", "Payment details"].map((x) => <div key={x} className="flex items-center gap-3 border-b border-border py-4 font-mono text-[10px] text-muted-foreground"><LockKeyhole className="size-3 text-proof" />{x}</div>)}</div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ProgrammableMoney() {
  const [active, setActive] = useState(0);
  return (
    <section className="section-shell border-y border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>07 / Programmable money</SectionLabel>
        <Reveal><h2 className="heading-xl">Privacy is only the beginning.</h2><p className="mt-5 text-xl text-muted-foreground sm:text-2xl">Private money becomes powerful when you can program it.</p></Reveal>
        <div className="mt-14 grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <div className="grid grid-cols-2 gap-px bg-border">
            {policies.map((policy, index) => <button key={policy.name} onClick={() => setActive(index)} className={`min-h-44 cursor-pointer bg-background p-5 text-left transition-colors ${active === index ? "bg-primary/5" : "hover:bg-card"}`}><span className="font-mono text-[9px] text-muted-foreground">{policy.id}</span><policy.icon className={`my-5 size-5 ${active === index ? "text-primary" : "text-muted-foreground"}`} /><span className="block text-sm font-medium">{policy.name}</span></button>)}
          </div>
          <div className="border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-border pb-5"><p className="terminal-label">XERO POLICY / {policies[active].id}</p><span className="status-dot">ACTIVE</span></div>
            <AnimatePresence mode="wait"><motion.div key={active} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="py-10"><p className="terminal-label">{policies[active].title}</p><p className="mt-3 font-mono text-3xl text-primary">{policies[active].value}</p><p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">{policies[active].copy}</p></motion.div></AnimatePresence>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6 font-mono text-[9px]"><span>PAYMENT REQUEST</span><ArrowRight className="size-3 text-muted-foreground" /><span>POLICY CHECK</span><ArrowRight className="size-3 text-muted-foreground" /><span className="text-primary">ALLOW ✓</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Agents() {
  return (
    <section className="section-shell overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>08 / Autonomous payments</SectionLabel>
        <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <Reveal><h2 className="heading-xl">Give agents money without giving them unlimited power.</h2><p className="mt-6 text-lg text-muted-foreground">Autonomous agents need wallets. Wallets need boundaries.</p><div className="mt-10 grid grid-cols-2 gap-px bg-border">{[["DAILY LIMIT", "$20"], ["APPROVED APPS", "8"], ["MAX PAYMENT", "$5"], ["KILL SWITCH", "READY"]].map(([a,b]) => <div className="bg-background p-4" key={a}><p className="terminal-label">{a}</p><p className="mt-2 font-mono text-lg text-foreground">{b}</p></div>)}</div></Reveal>
          <Reveal className="relative border border-border bg-card p-6 sm:p-10">
            <div className="protocol-grid absolute inset-0 opacity-20" />
            <div className="relative flex flex-col items-center">
              {["AI AGENT", "XERO WALLET", "POLICY ENGINE", "ZK PRIVACY", "PRIVATE PAYMENT", "SOLANA"].map((item, index) => <div className="contents" key={item}><div className={`w-full max-w-xs border px-5 py-3 text-center font-mono text-[9px] tracking-[0.14em] ${index === 2 ? "border-proof/60 bg-proof/5 text-proof" : index === 4 ? "border-primary/60 bg-primary/5 text-primary" : "border-border bg-background"}`}>{item}</div>{index < 5 && <FlowLine />}</div>)}
            </div>
            <div className="relative mt-8 grid grid-cols-2 gap-px bg-border"><div className="bg-background p-4 font-mono text-[9px]"><span className="text-primary">✓ ALLOW</span><p className="mt-2 text-muted-foreground">AUTHORIZED REQUEST</p></div><div className="bg-background p-4 font-mono text-[9px]"><span className="text-error">× DENIED</span><p className="mt-2 text-muted-foreground">POLICY VIOLATION</p></div></div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function LiveDemo() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (!running) return;
    if (step >= demoSteps.length - 1) { const done = window.setTimeout(() => setRunning(false), 650); return () => window.clearTimeout(done); }
    const timer = window.setTimeout(() => setStep((s) => s + 1), 520);
    return () => window.clearTimeout(timer);
  }, [running, step]);
  const run = () => { setStep(-1); setRunning(true); };
  return (
    <section id="demo" className="section-shell border-y border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>09 / Live payment demo</SectionLabel>
        <Reveal><h2 className="heading-xl">Watch a private payment happen.</h2></Reveal>
        <div className="mt-12 grid overflow-hidden border border-border bg-background lg:grid-cols-[1.25fr_.75fr]">
          <div className="border-b border-border p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="mb-8 flex items-center justify-between"><div className="flex items-center gap-3"><Terminal className="size-4 text-primary" /><div><p className="terminal-label">XERO AGENT</p><p className="mt-1 font-mono text-xs">research-agent-01</p></div></div><span className="status-dot">CONNECTED</span></div>
            <div className="border border-border bg-card p-5 font-mono text-[11px]"><p className="text-muted-foreground">REQUEST</p><div className="my-4 h-px bg-border"/><div className="grid grid-cols-[90px_1fr] gap-y-3"><span className="text-muted-foreground">Provider</span><span>data.api</span><span className="text-muted-foreground">Amount</span><span>$0.42</span><span className="text-muted-foreground">Policy</span><span>agent-default</span></div></div>
            <div className="mt-6 min-h-[218px] space-y-3">{demoSteps.map((item, index) => <motion.div key={item} animate={{ opacity: index <= step ? 1 : .25, x: index <= step ? 0 : -4 }} className="flex items-center gap-3 font-mono text-[10px]"><span className={`grid size-5 place-items-center border ${index <= step ? "border-primary/50 bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>{index <= step ? <Check className="size-3" /> : String(index + 1).padStart(2,"0")}</span>{item}</motion.div>)}</div>
            <Button onClick={run} disabled={running} className="mt-4 w-full sm:w-auto">{running ? "Processing…" : step === demoSteps.length - 1 ? "Run Again" : "Run Demo"}<ArrowRight /></Button>
          </div>
          <div className="bg-card p-5 sm:p-8"><p className="terminal-label">PUBLIC VIEW</p><div className="mt-8 space-y-0">{[["TRANSACTION", step >= 4 ? "VERIFIED" : "PENDING"], ["AMOUNT", "PRIVATE"], ["BALANCE", "PRIVATE"], ["POLICY", step >= 1 ? "VALID" : "—"]].map(([a,b],i) => <div key={a} className="flex items-center justify-between border-b border-border py-5 font-mono text-[10px]"><span className="text-muted-foreground">{a}</span><span className={i === 0 && step >= 4 || i === 3 && step >= 1 ? "text-primary" : "text-foreground"}>{b}</span></div>)}</div><div className="mt-10 flex aspect-square max-h-48 items-center justify-center border border-dashed border-border"><motion.div animate={step >= 3 ? { scale: [1, 1.12, 1], borderColor: ["var(--border)", "var(--primary)", "var(--border)"] } : {}} transition={{ repeat: Infinity, duration: 2 }} className="grid size-24 place-items-center rounded-full border border-border"><ShieldCheck className={`size-8 ${step >= 3 ? "text-primary" : "text-muted-foreground"}`} /></motion.div></div></div>
        </div>
        <p className="mt-4 font-mono text-[8px] text-muted-foreground">SIMULATION ONLY · NO BLOCKCHAIN TRANSACTION IS CREATED</p>
      </div>
    </section>
  );
}

function Disclosure() {
  const levels = ["PUBLIC", "AMOUNT PRIVATE", "BALANCE PRIVATE", "COUNTERPARTY PRIVATE", "FULLY SHIELDED"];
  const [level, setLevel] = useState(2);
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionLabel>10 / Selective disclosure</SectionLabel>
        <div className="grid gap-14 lg:grid-cols-2">
          <Reveal><h2 className="heading-xl">Privacy without losing trust.</h2><p className="mt-6 text-lg text-muted-foreground">Prove what matters. Reveal only what you choose.</p></Reveal>
          <Reveal>
            <div className="space-y-2">{levels.map((item,index) => <button key={item} onClick={() => setLevel(index)} className={`flex w-full cursor-pointer items-center justify-between border px-4 py-3 text-left font-mono text-[9px] transition-colors ${index === level ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}><span>{String(index+1).padStart(2,"0")} / {item}</span>{index <= level ? <LockKeyhole className="size-3"/> : <span>OPEN</span>}</button>)}</div>
            <div className="mt-6 grid grid-cols-2 gap-px bg-border">{["Sufficient funds", "Payment authorized", "Policy satisfied", "Payroll completed"].map((x) => <div key={x} className="flex items-center gap-2 bg-card p-4 font-mono text-[8px]"><Check className="size-3 text-primary" />{x}</div>)}</div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [["AI AGENTS", "Private autonomous spending.", "Agents pay APIs, compute services, data providers, and other agents within programmable policies.", Bot], ["BUSINESSES", "Private treasury and vendor payments.", "Move business funds without exposing the company’s complete payment history.", Network], ["PAYROLL", "Private salary distribution.", "Enable programmable payroll while minimizing public financial exposure.", WalletCards], ["SUBSCRIPTIONS", "Private recurring payments.", "Authorize recurring payments without broadcasting unnecessary financial information.", ReceiptText]] as const;
  return (
    <section id="use-cases" className="section-shell border-y border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionLabel>11 / Use cases</SectionLabel><Reveal><h2 className="heading-xl max-w-4xl">Built for money that shouldn&apos;t be public.</h2></Reveal><div className="mt-14 grid gap-px bg-border md:grid-cols-2">{cases.map(([title,subtitle,copy,Icon],i) => <Reveal key={title} className="group min-h-72 bg-background p-7 sm:p-9"><div className="flex items-start justify-between"><span className="font-mono text-[9px] text-muted-foreground">0{i+1}</span><Icon className="size-5 text-primary transition-transform group-hover:scale-110" /></div><h3 className="mt-16 text-xl font-semibold">{title}</h3><p className="mt-2 text-sm text-foreground/80">{subtitle}</p><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">{copy}</p></Reveal>)}</div><div className="mt-px flex flex-wrap gap-px bg-border">{["PRIVATE INVOICES","MERCHANT PAYMENTS","AGENT-TO-AGENT","TREASURY MANAGEMENT","API PAYMENTS","PRIVATE TRADING"].map(x => <span key={x} className="flex-1 bg-background px-5 py-4 text-center font-mono text-[8px] text-muted-foreground whitespace-nowrap">{x}</span>)}</div></div>
    </section>
  );
}

function Architecture() {
  const [active, setActive] = useState(0);
  return (
    <section className="section-shell"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionLabel>12 / Architecture</SectionLabel><div className="grid gap-14 lg:grid-cols-[.75fr_1.25fr]"><Reveal><h2 className="heading-xl">A privacy layer for programmable money.</h2><p className="mt-6 leading-7 text-muted-foreground">Each layer has one job. Together, they move dollar-denominated value with private, enforceable rules.</p></Reveal><Reveal><div className="mb-4 border border-border px-5 py-4 text-center font-mono text-[10px]">USER / AGENT</div>{layers.map(([title,copy,Icon], index) => <div key={title} className="contents"><FlowLine/><button onClick={() => setActive(index)} className={`group flex w-full cursor-pointer items-center gap-4 border px-5 py-4 text-left transition-colors ${active === index ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground"}`}><Icon className={`size-4 ${active === index ? "text-primary" : "text-muted-foreground"}`} /><span className="font-mono text-[9px] tracking-[0.12em]">{title}</span><span className="ml-auto hidden text-xs text-muted-foreground sm:block">{active === index ? copy : ""}</span><ChevronDown className={`size-3 transition-transform sm:hidden ${active === index ? "rotate-180 text-primary" : "text-muted-foreground"}`} /></button>{active === index && <p className="border-x border-b border-primary/40 px-5 py-4 text-xs text-muted-foreground sm:hidden">{copy}</p>}</div>)}</Reveal></div></div></section>
  );
}

function Developers() {
  return (
    <section id="developers" className="section-shell border-y border-border bg-surface/40"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionLabel>13 / Developer experience</SectionLabel><div className="grid gap-14 lg:grid-cols-2 lg:items-center"><Reveal><h2 className="heading-xl">One API for private money.</h2><p className="mt-6 max-w-lg leading-7 text-muted-foreground">Build wallets, agents, subscriptions, payroll, and private payment applications on XERO.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Button asChild><a href="#developers">Read the Docs <ArrowRight /></a></Button><Button variant="outline" asChild><a href="https://github.com" target="_blank" rel="noreferrer"><Github /> View GitHub</a></Button></div></Reveal><Reveal className="overflow-hidden border border-border bg-background"><div className="flex items-center justify-between border-b border-border px-5 py-3"><span className="font-mono text-[9px] text-muted-foreground">agent.ts</span><Code2 className="size-3 text-primary" /></div><pre className="overflow-x-auto p-5 font-mono text-[11px] leading-6 text-muted-foreground sm:p-7"><code><span className="text-proof">const</span> agent = <span className="text-proof">await</span> xero.wallet.createAgent({`{\n`}  budget: <span className="text-primary">100</span>,{`\n`}  dailyLimit: <span className="text-primary">20</span>,{`\n`}  allowedProviders: [{`\n`}    <span className="text-code">&quot;data.api&quot;</span>,{`\n`}    <span className="text-code">&quot;compute.api&quot;</span>{`\n`}  ]{`\n`}{`})\n\n`}<span className="text-proof">await</span> agent.pay({`{\n`}  recipient: provider,{`\n`}  amount: <span className="text-primary">0.42</span>{`\n`}{`})`}</code></pre></Reveal></div></div></section>
  );
}

function Security() {
  return (
    <section className="section-shell"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionLabel>14 / Security</SectionLabel><Reveal><h2 className="heading-xl">Cryptography, not promises.</h2></Reveal><div className="mt-14 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">{[["ZERO-KNOWLEDGE",KeyRound],["ENCRYPTION",LockKeyhole],["ONCHAIN VERIFICATION",ShieldCheck],["PROGRAMMABLE POLICIES",Braces]].map(([title,Icon]) => { const SecurityIcon = Icon; return <Reveal key={String(title)} className="min-h-48 bg-background p-6"><SecurityIcon className="size-5 text-primary"/><p className="mt-16 font-mono text-[9px] tracking-[0.12em]">{String(title)}</p></Reveal>})}</div><div className="mt-10 grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">{["Non-custodial architecture","Cryptographic verification","Transparent protocol rules","Security-first development","Independent audits before production"].map(x => <p key={x} className="flex gap-2"><Check className="mt-0.5 size-3 shrink-0 text-primary"/>{x}</p>)}</div></div></section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-y border-border py-28 sm:py-40"><div className="protocol-grid absolute inset-0 opacity-30"/><div className="relative mx-auto max-w-4xl px-5 text-center"><Reveal><Sparkles className="mx-auto mb-8 size-5 text-primary"/><h2 className="font-display text-4xl font-semibold leading-tight sm:text-6xl">Your money shouldn&apos;t have to explain itself.</h2><p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">Build payments that are private, programmable, and verifiable.</p><div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row"><Button size="lg" asChild><a href="#demo">Launch XERO <ArrowRight /></a></Button><Button size="lg" variant="outline" asChild><a href="#developers">Read the Docs <ArrowRight /></a></Button></div><p className="mt-10 font-mono text-[9px] tracking-[0.18em] text-muted-foreground">BUILT ON SOLANA · POWERED BY CRYPTOGRAPHY</p></Reveal></div></section>
  );
}

function Footer() {
  const columns = { PRODUCT: ["App","Technology","Use Cases","Roadmap"], DEVELOPERS: ["Docs","SDK","API","GitHub"], COMMUNITY: ["X","Discord","Telegram"], LEGAL: ["Privacy","Terms"] };
  return <footer className="px-5 py-14 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-12 border-b border-border pb-14 lg:grid-cols-[1.4fr_repeat(4,1fr)]"><div><Logo/><p className="mt-5 max-w-xs text-sm text-muted-foreground">Private programmable money on Solana.</p></div>{Object.entries(columns).map(([title,items]) => <div key={title}><p className="terminal-label">{title}</p><div className="mt-5 space-y-3">{items.map(x => <a key={x} href="#top" className="block text-xs text-muted-foreground transition-colors hover:text-foreground">{x}</a>)}</div></div>)}</div><div className="flex flex-col gap-3 pt-6 font-mono text-[8px] tracking-[0.14em] text-muted-foreground sm:flex-row sm:justify-between"><span>© 2026 XERO</span><span>BUILT ON SOLANA</span></div></div></footer>;
}

export function XeroLanding() {
  return <main className="min-h-screen overflow-x-hidden bg-background text-foreground"><Navbar/><Hero/><TrustStrip/><Problem/><Solution/><PrivateVerifiable/><ProgrammableMoney/><Agents/><LiveDemo/><Disclosure/><UseCases/><Architecture/><Developers/><Security/><FinalCta/><Footer/></main>;
}