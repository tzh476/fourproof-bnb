import type { AgentCategory, CategoryDefinition } from "./types";

export const categoryDefinitions: Record<AgentCategory, CategoryDefinition> = {
  rebalancing: {
    id: "rebalancing",
    label: "Portfolio rebalancing",
    shortLabel: "Rebalancing",
    description: "Target-weight drift, LP-range resets, and bounded allocation plans.",
    searches: ["portfolio rebalancing", "LP rebalancing"],
    keywords: ["rebalance", "rebalancing", "target weight", "lp range", "allocation"],
    accent: "#45d8a0",
  },
  "grid-trading": {
    id: "grid-trading",
    label: "Grid trading",
    shortLabel: "Grid trading",
    description: "Grid design and management with explicit fee, slippage, and loss bounds.",
    searches: ["grid trading", "grid trader"],
    keywords: ["grid", "spacing", "rung", "range", "pancakeswap"],
    accent: "#efc86d",
  },
  "yield-optimisation": {
    id: "yield-optimisation",
    label: "Yield optimisation",
    shortLabel: "Yield",
    description: "Comparable routes for lending, staking, and liquidity yield on BSC.",
    searches: ["yield optimiser", "yield optimization", "venus yield"],
    keywords: ["yield", "apr", "apy", "lending", "staking", "liquidity"],
    accent: "#70b6ff",
  },
  "health-factor": {
    id: "health-factor",
    label: "Health factor monitoring",
    shortLabel: "Health factor",
    description: "Liquidation-risk evidence, stress tests, and bounded rescue plans.",
    searches: ["health factor", "liquidation protection", "venus monitor"],
    keywords: ["health factor", "liquidation", "collateral", "venus", "lending position"],
    accent: "#ff7f78",
  },
};
