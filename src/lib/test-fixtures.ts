import type { AgentDetail } from "./types";

export function agentFixture(overrides: Partial<AgentDetail> = {}): AgentDetail {
  return {
    tokenId: "42",
    chainId: 56,
    contractAddress: "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
    ownerAddress: "0x1111111111111111111111111111111111111111",
    name: "Measured Portfolio Rebalancer",
    description: "Measures target weight drift and proposes a bounded portfolio rebalance.",
    supportedProtocols: ["A2A"],
    x402Supported: false,
    totalScore: 23,
    totalFeedbacks: 2,
    averageScore: 4,
    isVerified: false,
    isActive: true,
    createdAt: "2026-08-29T00:00:00Z",
    agentWallet: "0x2222222222222222222222222222222222222222",
    metadataCompleteness: 80,
    healthScore: 95,
    overallStatus: "healthy",
    parseStatus: "success",
    createdTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    services: [
      {
        name: "a2a",
        endpoint: "https://agent.example/a2a",
        executionEndpoint: "https://agent.example/a2a/messages",
        executionTargetVerified: true,
        status: "healthy",
        message: "Healthy AgentCard",
        checkedAt: "2026-08-29T00:00:00Z",
        domainVerified: true,
      },
    ],
    ...overrides,
  };
}
