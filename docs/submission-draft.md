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

Working MVP with a public source repository and live Cloudflare Pages deployment at `https://fourproof-bnb.pages.dev`. Wallet-owned registration or activation and contest submission are still pending.

## BNB integration

- BSC mainnet ERC-8004 identity data.
- Canonical Identity Registry `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`.
- Live `ownerOf` and `tokenURI` reads via BSC RPC.
- BscScan links for identities and registration transactions.
- Four publicly deployed first-party deterministic A2A reference services; applicant-signed ERC-8004 registration remains pending.
- Future user-wallet activation through the official BNB Agent SDK / ERC-8183 stack after an explicit transaction review.

## Claims we do not make

- Registration does not mean an agent is safe, endorsed, or profitable.
- A published discovery URL does not mean its execution target is callable.
- A healthy AgentCard does not prove execution health or output quality.
- No prize, customer, revenue, or payment exists.

## Form-ready answers

These answers mirror the live Google Form inspected on 2026-08-29. They exclude contact details, wallet data, personal experience claims, availability, and agreement choices.

| Form field | Draft answer |
| --- | --- |
| How did you hear about this hackathon? | BNB Chain Website |
| Solo or team | Solo |
| Number of teammates | 1 (Solo) |
| Project name | FourProof |
| One-line pitch | An evidence-first BNB agent marketplace that separates identity, discovery health, and execution readiness across all four required DeFi categories before an agent gets near a wallet. |
| Project description | Use the three paragraphs under **Project description** above. |
| Sub-prize tracks | Not sure. Do not select a partner track unless the implementation actually satisfies that partner's published requirements. |
| GitHub repository | https://github.com/tzh476/fourproof-bnb |
| Prototype stage | Working MVP |
| Public demo | https://fourproof-bnb.pages.dev |

The current form does not provide a separate public-demo field. The repository README links the live deployment so reviewers can reach it from the required GitHub field.

## Remaining form fields owned by the applicant

- Google account login and recorded-email choice;
- full name, email, country/timezone, and any optional Discord handle;
- Telegram handle;
- X handle;
- BSC/EVM experience level and personal skills;
- mentorship preference and availability confirmation;
- wallet address;
- participation-terms acceptance;
- final submission.
