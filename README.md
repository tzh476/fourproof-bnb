# FourProof BNB

FourProof is an evidence-first discovery interface for DeFi agents registered on BNB Smart Chain. It covers the four categories required by **The Smart Money Era: Build the Era** main track with equal depth:

1. portfolio rebalancing;
2. grid trading;
3. yield optimisation;
4. health-factor monitoring.

The differentiator is a strict trust boundary. Agent descriptions are treated as publisher claims. The ranking score uses observed BSC registration, protocol metadata, scanner-observed discovery health, domain evidence, execution-target checks, metadata completeness, wallet publication, and feedback volume. Missing evidence blocks activation instead of being silently replaced with optimistic assumptions.

## Current status

This is a working MVP with public source at `https://github.com/tzh476/fourproof-bnb` and a live demo at `https://fourproof-bnb.pages.dev`. A project-bearing Google Forms submission receipt has been verified. That receipt is not a shortlist, award, or payment; USD 0 has been received.

Implemented:

- live 8004scan discovery on BSC mainnet;
- equal-depth search and ranking for all four required categories;
- schema validation at the external API boundary;
- direct `ownerOf` and `tokenURI` verification against the canonical ERC-8004 registry;
- transparent discovery-health, execution-target, and activation-blocking reasons;
- a bounded live A2A probe that sends no wallet, credential, signature, or funds;
- registry-bound response validation against the selected ERC-8004 token and published wallet;
- read-only activation-plan generation only after the BSC owner and live response gates pass;
- four deterministic, first-party A2A reference endpoints for non-financial category demos;
- responsive marketplace UI and deterministic unit tests.

Remaining work to strengthen the entry:

- repeat the registry-bound execution path in more than one category when suitable public agents exist;
- preserve the current no-wallet/no-transaction boundary unless a separately reviewed flow genuinely needs a user signature;
- prepare current judging collateral if the organizer asks for an updated demo or video.

## Run locally

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
npm run check
npm run dev
# Or run the frontend and Pages Functions together:
npm run dev:pages
```

Open the URL printed by Vite. The app calls the public 8004scan API and BSC RPC from the browser; it does not require an API key.

## Evidence model

The evidence tier is intentionally monotonic:

```text
metadata-only
  -> registered (canonical BSC ERC-8004 identity)
  -> reachable (A2A/MCP plus healthy or degraded discovery metadata)
  -> operational (bounded execution response bound to the ERC-8004 token and published agent wallet)
```

An onchain identity is not proof of safety, profitability, or correct output. FourProof never turns a description, token registration, or high self-reported score into an endorsement.

## Data sources

- `https://api.8004scan.io/api/v1/agents`: indexed ERC-8004 metadata and health observations, accessed through a same-origin, read-only proxy.
- BSC mainnet RPC: direct registry reads.
- Canonical BSC ERC-8004 registry: `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`.

The browser never receives an API credential. Local Vite development proxies the allowlisted read routes, and `functions/api/8004scan/[[path]].ts` provides the same route shape for Cloudflare Pages. The proxy accepts only agent-list queries on chain 56 and numeric BSC agent-detail paths.

A marketplace refresh makes at most 16 upstream requests: one focused search and up to three detail reads for each category. This stays below the current unauthenticated 30-request-per-minute limit and matches the three cards rendered per category.

## First-party A2A reference suite

The Pages Function route `/agents/:category/*` exposes one AgentCard and one A2A `message/send` endpoint for each required category. These endpoints accept structured caller-supplied observations and return deterministic plans or explicit rejections. They do not fetch private data, place trades, hold funds, or claim live prices.

```text
GET  /agents/rebalancing/.well-known/agent-card.json
POST /agents/rebalancing/a2a
GET  /agents/grid-trading/.well-known/agent-card.json
POST /agents/grid-trading/a2a
GET  /agents/yield-optimisation/.well-known/agent-card.json
POST /agents/yield-optimisation/a2a
GET  /agents/health-factor/.well-known/agent-card.json
POST /agents/health-factor/a2a
```

They are publicly deployed under `https://fourproof-bnb.pages.dev/agents/`, but they are not represented as BSC identities until the applicant personally signs ERC-8004 registration transactions. The UI therefore does not present them as registered or operational.

## Security and financial boundary

- No seed phrase, private key, wallet password, or payment credential belongs in this project.
- The MVP does not send transactions. Its only external activation action is a capability-only A2A message with no wallet, authentication, signature, or funds.
- The live probe accepts only public HTTPS, same-origin AgentCard/execution targets and rejects local, IP-literal, plaintext, cross-origin, oversized, or identity-mismatched responses.
- Activation plans are local JSON with read-only, no-custody, and no-trading controls. They require both a fresh BSC owner proof and a registry-bound execution response.
- A future transaction path must use an injected user wallet, display chain/contract/amount/expiry, and require an explicit user signature.
- This project does not claim that any surfaced agent is safe or profitable.
