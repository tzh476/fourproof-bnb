import { z } from "zod";
import { rankAgent, strongestService } from "./scoring";
import type { RankedAgent } from "./types";

const BSC_CHAIN_ID = 56;
const BSC_REGISTRY = "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432";
const CANONICAL_REGISTRY = `eip155:${BSC_CHAIN_ID}:${BSC_REGISTRY}`;
const MAX_RESPONSE_BYTES = 64_000;
const REQUEST_TIMEOUT_MS = 12_000;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const registrationSchema = z.object({
  agentId: z.union([z.string(), z.number()]).transform(String),
  agentRegistry: z.string(),
});

const agentCardSchema = z.object({
  name: z.string().min(1).max(180),
  url: z.string().url(),
  registrations: z.array(registrationSchema).catch([]),
});

const responseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  result: z.object({
    kind: z.literal("message"),
    messageId: z.string().min(1).max(200),
    role: z.literal("agent"),
    parts: z.array(z.object({ kind: z.string() }).passthrough()).min(1),
  }),
});

const identityBindingSchema = z.object({
  erc8004AgentId: z.union([z.string(), z.number()]).transform(String),
  agentWallet: z.string(),
  registrations: z.array(registrationSchema),
  skills: z.array(z.object({
    id: z.string().catch(""),
    name: z.string().catch(""),
    description: z.string().catch(""),
    tags: z.array(z.string()).catch([]),
  })).catch([]),
});

export interface ExecutionReceipt {
  version: "fourproof.execution.v1";
  agentTokenId: string;
  category: RankedAgent["category"];
  agentWallet: `0x${string}`;
  discoveryUrl: string;
  executionEndpoint: string;
  remoteMessageId: string;
  checkedAt: string;
  responseSummary: string;
  controls: {
    readOnly: true;
    noWallet: true;
    noAuth: true;
    noCustody: true;
    noTrading: true;
  };
}

function canonicalRegistration(registrations: z.infer<typeof registrationSchema>[], tokenId: string): boolean {
  return registrations.some(
    (registration) =>
      registration.agentId === tokenId && registration.agentRegistry.toLowerCase() === CANONICAL_REGISTRY,
  );
}

function safePublicHttpsUrl(candidate: string, label: string): URL {
  const url = new URL(candidate);
  const hostname = url.hostname.toLowerCase();
  const looksLikeIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const blockedName =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal");

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    looksLikeIpv4 ||
    hostname.includes(":") ||
    blockedName
  ) {
    throw new Error(`${label} is not a safe public HTTPS target`);
  }
  return url;
}

function safeExecutionUrl(discoveryUrl: URL, candidate: string): URL {
  const execution = safePublicHttpsUrl(candidate, "AgentCard execution URL");
  if (execution.origin !== discoveryUrl.origin) {
    throw new Error("AgentCard execution URL does not share the discovery origin");
  }
  return execution;
}

async function boundedJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error(`${label} exceeded the response-size limit`);
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new Error(`${label} exceeded the response-size limit`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

function legacyAgentId(discoveryUrl: string, registrations: z.infer<typeof registrationSchema>[]): number | null {
  const pathMatch = new URL(discoveryUrl).pathname.match(/\/agents\/(\d+)\/agent-card\.json$/i);
  if (pathMatch) return Number(pathMatch[1]);
  const legacy = registrations.find(
    (registration) => registration.agentRegistry.toLowerCase() !== CANONICAL_REGISTRY,
  );
  return legacy && /^\d+$/.test(legacy.agentId) ? Number(legacy.agentId) : null;
}

function walletAddress(value: string): `0x${string}` | null {
  const match = value.match(/^eip155:56:(0x[0-9a-fA-F]{40})$/);
  return match ? (match[1].toLowerCase() as `0x${string}`) : null;
}

function capabilityMatchesCategory(
  category: RankedAgent["category"],
  skills: z.infer<typeof identityBindingSchema>["skills"],
): boolean {
  const keywords: Record<RankedAgent["category"], string[]> = {
    rebalancing: ["rebalance", "portfolio", "allocation", "market-cap", "index", "hrp"],
    "grid-trading": ["grid", "range", "spacing", "rung"],
    "yield-optimisation": ["yield", "vault", "apr", "apy", "lending", "staking"],
    "health-factor": ["health factor", "liquidation", "collateral", "borrow"],
  };
  const capabilityText = skills
    .map((skill) => `${skill.id} ${skill.name} ${skill.description} ${skill.tags.join(" ")}`)
    .join(" ")
    .toLowerCase();
  return keywords[category].some((keyword) => capabilityText.includes(keyword));
}

export async function runBoundedA2AProbe(
  agent: RankedAgent,
  fetcher: Fetcher = fetch,
): Promise<ExecutionReceipt> {
  if (!agent.agentWallet) throw new Error("The agent has no published wallet to bind the response to");
  const service = strongestService(agent.services);
  if (!service?.endpoint || service.status !== "healthy" || service.name.toLowerCase() !== "a2a") {
    throw new Error("A healthy A2A discovery URL is required for a bounded probe");
  }

  const discoveryUrl = safePublicHttpsUrl(service.endpoint, "A2A discovery URL");
  const discoveryResponse = await fetcher(discoveryUrl, {
    headers: { Accept: "application/json" },
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const card = agentCardSchema.parse(await boundedJson(discoveryResponse, "AgentCard"));
  if (!canonicalRegistration(card.registrations, agent.tokenId)) {
    throw new Error("AgentCard does not bind to this canonical BSC ERC-8004 identity");
  }

  const execution = safeExecutionUrl(discoveryUrl, card.url);
  const requestId = `fourproof-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const nfaTokenId = legacyAgentId(service.endpoint, card.registrations);
  const metadata = nfaTokenId === null ? undefined : { nfaTokenId };
  const executionResponse = await fetcher(execution, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method: "message/send",
      params: {
        message: {
          kind: "message",
          role: "user",
          messageId: requestId,
          metadata,
          parts: [
            {
              kind: "text",
              text: `FourProof read-only activation probe for ${agent.category}. Return identity and capability evidence only. Do not create, sign, submit, fund, or execute any transaction.`,
            },
          ],
        },
      },
    }),
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const rawResponse = await boundedJson(executionResponse, "A2A execution target");
  const parsedResponse = responseSchema.parse(rawResponse);
  if (String(parsedResponse.id) !== requestId) throw new Error("A2A response ID does not match the request");

  const dataPart = parsedResponse.result.parts.find((part) => part.kind === "data") as
    | { kind: string; data?: unknown }
    | undefined;
  const binding = identityBindingSchema.parse(dataPart?.data);
  const boundWallet = walletAddress(binding.agentWallet);
  if (binding.erc8004AgentId !== agent.tokenId) {
    throw new Error("A2A response identifies a different ERC-8004 token");
  }
  if (!boundWallet || boundWallet !== agent.agentWallet.toLowerCase()) {
    throw new Error("A2A response wallet does not match the indexed agent wallet");
  }
  if (!canonicalRegistration(binding.registrations, agent.tokenId)) {
    throw new Error("A2A response does not repeat the canonical BSC registration");
  }
  if (!capabilityMatchesCategory(agent.category, binding.skills)) {
    throw new Error("A2A response does not advertise a capability for this marketplace category");
  }

  const textPart = parsedResponse.result.parts.find((part) => part.kind === "text") as
    | { kind: string; text?: unknown }
    | undefined;
  const summary = typeof textPart?.text === "string" ? textPart.text.slice(0, 500) : "Identity-bound A2A response received.";

  return {
    version: "fourproof.execution.v1",
    agentTokenId: agent.tokenId,
    category: agent.category,
    agentWallet: boundWallet,
    discoveryUrl: service.endpoint,
    executionEndpoint: execution.toString(),
    remoteMessageId: parsedResponse.result.messageId,
    checkedAt: new Date().toISOString(),
    responseSummary: summary,
    controls: {
      readOnly: true,
      noWallet: true,
      noAuth: true,
      noCustody: true,
      noTrading: true,
    },
  };
}

export function applyExecutionReceipt(agent: RankedAgent, receipt: ExecutionReceipt): RankedAgent {
  if (
    receipt.agentTokenId !== agent.tokenId ||
    receipt.category !== agent.category ||
    receipt.agentWallet !== agent.agentWallet?.toLowerCase()
  ) {
    throw new Error("Execution receipt does not belong to this agent");
  }
  let matched = false;
  const services = agent.services.map((service) => {
    if (service.endpoint !== receipt.discoveryUrl) return service;
    matched = true;
    return {
      ...service,
      executionEndpoint: receipt.executionEndpoint,
      executionTargetVerified: true,
      executionIdentityVerified: true,
      executionCheckedAt: receipt.checkedAt,
    };
  });
  if (!matched) throw new Error("Execution receipt discovery URL is not published by this agent");
  return rankAgent({ ...agent, services }, agent.category);
}
