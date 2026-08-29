# Build the Era submission draft — not submitted

## Project name

FourProof

## One-line pitch

An evidence-first BNB agent marketplace that separates identity, discovery health, and execution readiness across all four required DeFi categories before an agent gets near a wallet.

## Project description

FourProof turns BSC's large ERC-8004 agent registry into a usable, falsifiable marketplace. It discovers agents in portfolio rebalancing, grid trading, yield optimisation, and health-factor monitoring with equal depth. Each candidate receives an evidence score built from canonical BSC registration, A2A/MCP support, scanner-observed discovery health, domain evidence, execution-target checks, metadata completeness, wallet publication, and feedback—not promotional claims.

Users can inspect the exact registry token, owner, registration transaction, discovery URL, health-check timestamp, and blocking reasons. A direct BSC read verifies `ownerOf` and `tokenURI` independently of the indexer. Only candidates that also pass domain and execution-target checks can produce a bounded activation plan; the MVP plan is explicitly read-only, non-custodial, non-trading, and expires after 30 minutes.

The product's central bet is that discovery without evidence is not a marketplace: it is a directory. FourProof makes missing evidence visible and makes unsafe optimism impossible to hide behind a polished agent description.

## Prototype stage

Working local MVP. Public deployment, wallet-owned activation, public repository, and contest submission are still pending.

## BNB integration

- BSC mainnet ERC-8004 identity data.
- Canonical Identity Registry `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`.
- Live `ownerOf` and `tokenURI` reads via BSC RPC.
- BscScan links for identities and registration transactions.
- Four first-party deterministic A2A reference services, ready for public deployment and applicant-signed ERC-8004 registration.
- Future user-wallet activation through the official BNB Agent SDK / ERC-8183 stack after an explicit transaction review.

## Claims we do not make

- Registration does not mean an agent is safe, endorsed, or profitable.
- A published discovery URL does not mean its execution target is callable.
- A healthy AgentCard does not prove execution health or output quality.
- No prize, customer, revenue, or payment exists.

## Remaining form fields owned by the applicant

- Telegram handle;
- X handle;
- wallet address;
- public GitHub repository URL;
- public demo URL;
- participation-terms acceptance;
- final submission.
