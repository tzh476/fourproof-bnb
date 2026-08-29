import { categoryDefinitions } from "./categories";
import type { AgentCategory, AgentDetail, RankedAgent, ServiceHealth } from "./types";

const BSC_CHAIN_ID = 56;
const BSC_REGISTRY = "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432";

function normalized(value: string): string {
  return value.toLocaleLowerCase();
}

export function categoryRelevance(agent: AgentDetail, category: AgentCategory): number {
  const haystack = normalized(`${agent.name} ${agent.description}`);
  const { keywords } = categoryDefinitions[category];
  const matched = keywords.filter((keyword) => haystack.includes(keyword)).length;
  const nameMatches = keywords.filter((keyword) => normalized(agent.name).includes(keyword)).length;
  return Math.min(30, matched * 5 + nameMatches * 5);
}

export function strongestService(services: ServiceHealth[]): ServiceHealth | null {
  const order = { healthy: 4, degraded: 3, unknown: 2, skipped: 1, unhealthy: 0 } as const;
  return [...services].sort((a, b) => order[b.status] - order[a.status])[0] ?? null;
}

export function rankAgent(agent: AgentDetail, category: AgentCategory): RankedAgent {
  const reasons: string[] = [];
  const relevanceScore = categoryRelevance(agent, category);
  const onBsc =
    agent.chainId === BSC_CHAIN_ID && normalized(agent.contractAddress) === BSC_REGISTRY;
  const callableProtocol = agent.supportedProtocols.some((protocol) =>
    ["a2a", "mcp"].includes(normalized(protocol)),
  );
  const bestService = strongestService(agent.services);
  const discoveryReachable = bestService?.status === "healthy" || bestService?.status === "degraded";
  const discoveryHealthy = bestService?.status === "healthy";
  const executionTargetVerified = bestService?.executionTargetVerified === true;

  if (!onBsc) reasons.push("Identity is not confirmed on the canonical BSC registry");
  if (!callableProtocol) reasons.push("No A2A or MCP protocol is advertised");
  if (!bestService?.endpoint) reasons.push("No A2A or MCP discovery URL is published");
  if (!discoveryReachable) reasons.push("Published service metadata is not currently reachable");
  if (bestService?.endpoint && !bestService.domainVerified) {
    reasons.push("Discovery-domain ownership is not verified");
  }
  if (discoveryReachable && !executionTargetVerified) {
    reasons.push("The execution target has not passed a bounded public-call check");
  }
  if (!agent.agentWallet) reasons.push("No agent wallet is published");

  let evidenceScore = relevanceScore;
  evidenceScore += onBsc ? 20 : 0;
  evidenceScore += callableProtocol ? 10 : 0;
  evidenceScore += bestService?.endpoint ? 5 : 0;
  evidenceScore += discoveryHealthy ? 15 : bestService?.status === "degraded" ? 8 : 0;
  evidenceScore += bestService?.domainVerified ? 5 : 0;
  evidenceScore += executionTargetVerified ? 10 : 0;
  evidenceScore += Math.min(10, agent.metadataCompleteness / 10);
  evidenceScore += agent.agentWallet ? 5 : 0;
  evidenceScore += Math.min(5, agent.totalFeedbacks);
  evidenceScore = Math.round(Math.min(100, evidenceScore));

  let evidenceTier: RankedAgent["evidenceTier"] = "metadata-only";
  if (onBsc) evidenceTier = "registered";
  if (onBsc && discoveryReachable && callableProtocol) evidenceTier = "reachable";
  if (
    onBsc &&
    discoveryHealthy &&
    callableProtocol &&
    bestService?.domainVerified &&
    executionTargetVerified &&
    agent.agentWallet
  ) {
    evidenceTier = "operational";
  }

  return {
    ...agent,
    category,
    relevanceScore,
    evidenceScore,
    evidenceTier,
    activationBlockedReasons: reasons,
  };
}

export function rankAgents(agents: AgentDetail[], category: AgentCategory): RankedAgent[] {
  return agents
    .map((agent) => rankAgent(agent, category))
    .filter((agent) => agent.relevanceScore > 0)
    .sort((a, b) => b.evidenceScore - a.evidenceScore || b.totalScore - a.totalScore);
}
