import { z } from "zod";
import { categoryDefinitions } from "./categories";
import { rankAgents } from "./scoring";
import type {
  AgentCategory,
  AgentDetail,
  AgentSummary,
  CategoryResult,
  ServiceHealth,
} from "./types";

const API_BASE = "/api/8004scan";
const REQUEST_TIMEOUT_MS = 8_000;

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const summarySchema = z.object({
  token_id: z.union([z.string(), z.number()]).transform(String),
  chain_id: z.number(),
  contract_address: addressSchema,
  owner_address: addressSchema,
  name: z.string().min(1).max(180),
  description: z.string().max(20_000).catch(""),
  supported_protocols: z.array(z.string()).catch([]),
  x402_supported: z.boolean().catch(false),
  total_score: z.number().catch(0),
  total_feedbacks: z.number().catch(0),
  average_score: z.number().catch(0),
  is_verified: z.boolean().catch(false),
  is_active: z.boolean().catch(true),
  created_at: z.string().nullable().catch(null),
});

const listSchema = z.object({
  items: z.array(summarySchema),
});

const detailSchema = summarySchema.extend({
  agent_wallet: addressSchema.nullable().catch(null),
  scores: z
    .object({ metadata_completeness: z.number().catch(0) })
    .partial()
    .catch({}),
  health_score: z.number().nullable().catch(null),
  health_status: z
    .object({
      overall_status: z.string().catch("unknown"),
      services: z.record(
        z.string(),
        z.object({
          status: z.string().catch("unknown"),
          message: z.string().nullable().catch(null),
          checked_at: z.string().nullable().catch(null),
          domain_verified: z.boolean().catch(false),
        }),
      ).catch({}),
    })
    .partial()
    .catch({}),
  services: z.record(z.string(), z.unknown()).catch({}),
  parse_status: z.object({ status: z.string().catch("unknown") }).partial().catch({}),
  created_tx_hash: txHashSchema.nullable().catch(null),
});

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`8004scan returned HTTP ${response.status}`);
  }
  return response.json();
}

function toSummary(raw: z.infer<typeof summarySchema>): AgentSummary {
  return {
    tokenId: raw.token_id,
    chainId: raw.chain_id,
    contractAddress: raw.contract_address.toLowerCase() as `0x${string}`,
    ownerAddress: raw.owner_address.toLowerCase() as `0x${string}`,
    name: raw.name,
    description: raw.description.slice(0, 1_500),
    supportedProtocols: raw.supported_protocols,
    x402Supported: raw.x402_supported,
    totalScore: raw.total_score,
    totalFeedbacks: raw.total_feedbacks,
    averageScore: raw.average_score,
    isVerified: raw.is_verified,
    isActive: raw.is_active,
    createdAt: raw.created_at,
  };
}

function normalizeServiceStatus(status: string): ServiceHealth["status"] {
  const value = status.toLowerCase();
  if (["healthy", "degraded", "unhealthy", "skipped"].includes(value)) {
    return value as ServiceHealth["status"];
  }
  return "unknown";
}

function serviceEndpoint(rawServices: Record<string, unknown>, name: string): string | null {
  const raw = rawServices[name];
  if (!raw || typeof raw !== "object") return null;
  const endpoint = (raw as Record<string, unknown>).endpoint;
  return typeof endpoint === "string" && /^https?:\/\//.test(endpoint) ? endpoint : null;
}

function toDetail(raw: z.infer<typeof detailSchema>): AgentDetail {
  const healthServices = raw.health_status.services ?? {};
  const services: ServiceHealth[] = Object.entries(healthServices).map(([name, health]) => ({
    name,
    endpoint: serviceEndpoint(raw.services, name),
    executionEndpoint: null,
    executionTargetVerified: false,
    status: normalizeServiceStatus(health.status),
    message: health.message,
    checkedAt: health.checked_at,
    domainVerified: health.domain_verified,
  }));

  for (const name of Object.keys(raw.services)) {
    if (!services.some((service) => service.name === name)) {
      services.push({
        name,
        endpoint: serviceEndpoint(raw.services, name),
        executionEndpoint: null,
        executionTargetVerified: false,
        status: "unknown",
        message: null,
        checkedAt: null,
        domainVerified: false,
      });
    }
  }

  return {
    ...toSummary(raw),
    agentWallet: raw.agent_wallet?.toLowerCase() as `0x${string}` | null,
    metadataCompleteness: raw.scores.metadata_completeness ?? 0,
    healthScore: raw.health_score,
    overallStatus: raw.health_status.overall_status ?? "unknown",
    parseStatus: raw.parse_status.status ?? "unknown",
    createdTxHash: raw.created_tx_hash?.toLowerCase() as `0x${string}` | null,
    services,
  };
}

async function fetchSearch(search: string): Promise<AgentSummary[]> {
  const query = new URLSearchParams({ chain_id: "56", search, limit: "12" });
  const parsed = listSchema.parse(await fetchJson(`${API_BASE}/agents?${query}`));
  return parsed.items.map(toSummary);
}

async function fetchDetail(tokenId: string): Promise<AgentDetail> {
  const parsed = detailSchema.parse(await fetchJson(`${API_BASE}/agents/56/${encodeURIComponent(tokenId)}`));
  return toDetail(parsed);
}

function summaryRelevance(agent: AgentSummary, category: AgentCategory): number {
  const haystack = `${agent.name} ${agent.description}`.toLowerCase();
  return categoryDefinitions[category].keywords.reduce(
    (score, keyword) => score + (haystack.includes(keyword) ? 1 : 0),
    0,
  );
}

export async function fetchCategory(category: AgentCategory): Promise<CategoryResult> {
  const definition = categoryDefinitions[category];
  // The public API allows 30 requests/minute. One focused discovery query plus
  // at most five detail reads per category keeps a full four-category refresh
  // below that ceiling (24 calls) without an API key.
  const searches = await Promise.allSettled(definition.searches.slice(0, 1).map(fetchSearch));
  const unique = new Map<string, AgentSummary>();

  for (const result of searches) {
    if (result.status === "fulfilled") {
      for (const agent of result.value) unique.set(agent.tokenId, agent);
    }
  }

  if (unique.size === 0) {
    throw new Error(`No live agents returned for ${definition.label}`);
  }

  const detailResults = await Promise.allSettled(
    [...unique.values()]
      .sort((a, b) => summaryRelevance(b, category) - summaryRelevance(a, category))
      .slice(0, 5)
      .map((agent) => fetchDetail(agent.tokenId)),
  );
  const details = detailResults
    .filter((result): result is PromiseFulfilledResult<AgentDetail> => result.status === "fulfilled")
    .map((result) => result.value);

  if (details.length === 0) {
    throw new Error(`Agent details were unavailable for ${definition.label}`);
  }

  return {
    category: definition,
    agents: rankAgents(details, category).slice(0, 8),
    fetchedAt: new Date().toISOString(),
    source: "live",
    warning: searches.some((result) => result.status === "rejected")
      ? "Some discovery queries failed; ranking uses the successful live results."
      : undefined,
  };
}

export async function fetchMarketplace(): Promise<CategoryResult[]> {
  const results = await Promise.allSettled(
    (Object.keys(categoryDefinitions) as AgentCategory[]).map(fetchCategory),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length === results.length) {
    throw new Error("Live BSC agent discovery is temporarily unavailable");
  }
  return results
    .filter((result): result is PromiseFulfilledResult<CategoryResult> => result.status === "fulfilled")
    .map((result) => result.value);
}
