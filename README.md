# ZERO

Private programmable money on Solana. This repo holds three independent projects:

| Directory | What it is | Stack |
| --- | --- | --- |
| [`site/`](site/) | Marketing website (zero landing page) | TanStack Start, React, Tailwind, Vite; built for Cloudflare Workers via Nitro |
| [`protocol/`](protocol/) | `zero_policy` Solana program: policy-controlled vault for AI-agent payments | Anchor 1.2, Rust, TypeScript tests on LiteSVM |
| [`sdk/`](sdk/) | `@zero/sdk`: TypeScript client for `zero_policy` | TypeScript (ESM), @solana/web3.js v1, Anchor client; tests on a local validator |

They share nothing at the root: each has its own `package.json`, lockfile and `node_modules`,
and each is built, linted and tested from inside its own directory.

## Website

```sh
cd site
npm install
npm run dev      # local dev server
npm run build    # production build (.output/)
npm run lint
```

The website was created with [Lovable](https://lovable.dev); see [`site/AGENTS.md`](site/AGENTS.md)
and [`site/README.md`](site/README.md).

## Protocol

```sh
cd protocol
npm install
npm test         # anchor build --arch v2, then the LiteSVM test suite
npm run smoke    # run the example flow against a live local validator
```

Localnet only, test tokens only. The program keypair lives in `~/.config/zero/`, not in the repo. See [`protocol/README.md`](protocol/README.md) for
the program design, toolchain notes and deploy steps.

## SDK

```sh
cd sdk
npm install
npm test         # unit tests + integration tests against the real program on a local validator
npm run build    # ESM + type declarations (dist/)
npm run demo     # the website demo against localnet
```

The SDK's tests load `protocol/target/deploy/zero_policy.so`, so build the protocol first. See
[`sdk/README.md`](sdk/README.md).
