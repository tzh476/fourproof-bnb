# Architecture and evidence flow

```mermaid
flowchart LR
    U[User] --> UI[FourProof web UI]
    UI --> S[Four category searches]
    S --> API[8004scan public API]
    API --> V[Zod boundary validation]
    V --> R[Evidence ranking]
    R --> C[Category cards]
    C --> I[Receipt inspector]
    I --> RPC[BSC public RPC]
    RPC --> REG[Canonical ERC-8004 registry]
    I --> CARD[Public A2A AgentCard]
    CARD --> SAFE{HTTPS and same-origin checks}
    SAFE -->|pass| CALL[Capability-only A2A message]
    CALL --> BIND[Bind token, wallet, registry, and category skill]
    I --> G{Evidence gates}
    BIND --> G
    G -->|pass| P[Read-only activation plan]
    G -->|fail| B[Blocked with exact reasons]
    UI --> A2A[Four first-party deterministic A2A references]
    A2A --> D[Plan or explicit rejection]
```

## Observed facts versus claims

| Field | Treatment |
| --- | --- |
| Agent name and description | Publisher claim; used only for category relevance |
| Chain ID, registry address, token ID | Indexed fact, then directly verifiable on BSC |
| `ownerOf(tokenId)` and `tokenURI(tokenId)` | Direct live chain read |
| A2A/MCP discovery URL | Published metadata; not evidence that the execution target works |
| Discovery health | Scanner observation that an AgentCard or MCP document is readable |
| Domain verification | Scanner observation; useful evidence but not equivalent to an execution check |
| Execution target | Resolved from the AgentCard; must be public HTTPS, same-origin, and pass a bounded call |
| Execution identity | Response must repeat the selected canonical ERC-8004 token, wallet, registration, and category capability |
| Wallet address | Published metadata; not proof of balance or authorization |
| Returns, win rate, safety, and output quality | Never inferred; require separate task evidence |

## Ranking rationale

Category relevance is deliberately separate from evidence quality. A highly relevant description can make an agent eligible for a category list, but it cannot produce an operational tier without registry, protocol, healthy discovery, registry-bound execution, and wallet evidence.

The score is explainable and capped at 100:

- category relevance: up to 30;
- canonical BSC registry: 20;
- A2A or MCP protocol: 10;
- discovery URL published: 5;
- discovery health: up to 15;
- verified discovery domain: 5;
- validated execution target: 10;
- registry-bound execution identity: 5;
- metadata completeness: up to 10;
- agent wallet: 5;
- feedback volume: up to 5.

The UI presents the underlying facts and blocking reasons, not only the aggregate number.

## Activation boundary

The current MVP sends one capability-only A2A message only after a fresh direct BSC owner read. The message contains no wallet, authentication, signature, funds, or transaction instruction. FourProof validates the returned token, agent wallet, canonical registration, and category capability before it generates a local read-only plan. A readable AgentCard alone never passes the gate.

Any future paid or onchain path must remain a separate user-wallet flow with the contract address, token, amount, allowance, expiry, and transaction simulation visible before an explicit signature.

## Reference-agent boundary

The four first-party A2A routes are deterministic calculators, not autonomous traders. Each accepts only bounded structured inputs, returns JSON data, and declares read-only/no-custody/no-trading controls. They make the four-category demo reproducible without converting an unregistered service into an onchain identity claim. Deployment and ERC-8004 registration are separate states.
