export const categories = [
  "rebalancing",
  "grid-trading",
  "yield-optimisation",
  "health-factor",
] as const;

export type AgentCategory = (typeof categories)[number];

export interface CategoryDefinition {
  id: AgentCategory;
  label: string;
  shortLabel: string;
  description: string;
  searches: string[];
  keywords: string[];
  accent: string;
}

export interface AgentSummary {
  tokenId: string;
  chainId: number;
  contractAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
  name: string;
  description: string;
  supportedProtocols: string[];
  x402Supported: boolean;
  totalScore: number;
  totalFeedbacks: number;
  averageScore: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string | null;
}

export interface ServiceHealth {
  name: string;
  /** URL of the published AgentCard or MCP discovery document. */
  endpoint: string | null;
  /** Service URL declared inside discovery metadata, once independently resolved. */
  executionEndpoint: string | null;
  /** True only after a bounded request to executionEndpoint succeeds. */
  executionTargetVerified: boolean;
  /** True only when the bounded response binds back to this ERC-8004 token and wallet. */
  executionIdentityVerified: boolean;
  /** Client-observed time of the latest bounded execution check. */
  executionCheckedAt: string | null;
  status: "healthy" | "degraded" | "unhealthy" | "skipped" | "unknown";
  message: string | null;
  checkedAt: string | null;
  domainVerified: boolean;
}

export interface AgentDetail extends AgentSummary {
  agentWallet: `0x${string}` | null;
  metadataCompleteness: number;
  healthScore: number | null;
  overallStatus: string;
  parseStatus: string;
  createdTxHash: `0x${string}` | null;
  services: ServiceHealth[];
}

export interface RankedAgent extends AgentDetail {
  category: AgentCategory;
  relevanceScore: number;
  evidenceScore: number;
  evidenceTier: "operational" | "reachable" | "registered" | "metadata-only";
  activationBlockedReasons: string[];
}

export interface CategoryResult {
  category: CategoryDefinition;
  agents: RankedAgent[];
  fetchedAt: string;
  source: "live" | "fallback";
  warning?: string;
}

export interface RegistryProof {
  verified: boolean;
  owner: `0x${string}`;
  tokenUri: string;
  blockNumber: bigint;
  checkedAt: string;
}
