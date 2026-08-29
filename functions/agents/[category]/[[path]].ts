import { categories, type AgentCategory } from "../../../src/lib/types";
import { createReferencePlan } from "../../../src/lib/reference-agents";

interface PagesContext {
  request: Request;
  params: { category?: string; path?: string | string[] };
}

const MAX_BODY_BYTES = 32_000;

function categoryFrom(value: string | undefined): AgentCategory | null {
  return categories.includes(value as AgentCategory) ? (value as AgentCategory) : null;
}

function pathFrom(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join("/") : value ?? "";
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function card(request: Request, category: AgentCategory): Response {
  const origin = new URL(request.url).origin;
  const labels: Record<AgentCategory, string> = {
    rebalancing: "Portfolio Rebalancing",
    "grid-trading": "Bounded Grid Planning",
    "yield-optimisation": "Yield Comparison",
    "health-factor": "Health Factor Stress Test",
  };
  return json({
    name: `FourProof ${labels[category]} Reference Agent`,
    description: "Deterministic, read-only planning from caller-supplied observations. It never trades, holds funds, or claims live market data.",
    url: `${origin}/agents/${category}/a2a`,
    version: "0.1.0",
    protocolVersion: "0.3.0",
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [{ id: "plan", name: labels[category], description: "Return a bounded plan or explicit rejection from structured inputs.", tags: [category, "bnb-chain", "read-only", "deterministic"] }],
  });
}

function rpcError(id: unknown, code: number, message: string, status = 400): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const category = categoryFrom(context.params.category);
  const path = pathFrom(context.params.path);
  if (!category) return json({ error: "Unknown category" }, 404);

  if (context.request.method === "GET" && path === ".well-known/agent-card.json") {
    return card(context.request, category);
  }
  if (context.request.method !== "POST" || path !== "a2a") {
    return json({ error: "Route not found" }, 404);
  }
  if (!(context.request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return rpcError(null, -32600, "Content-Type must be application/json", 415);
  }
  const declaredLength = Number(context.request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return rpcError(null, -32600, "Request body is too large", 413);

  let body: unknown;
  try {
    const text = await context.request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return rpcError(null, -32600, "Request body is too large", 413);
    body = JSON.parse(text);
  } catch {
    return rpcError(null, -32700, "Invalid JSON");
  }
  if (!body || typeof body !== "object") return rpcError(null, -32600, "Invalid JSON-RPC request");
  const request = body as Record<string, unknown>;
  if (request.jsonrpc !== "2.0" || request.method !== "message/send") {
    return rpcError(request.id, -32601, "Only message/send is supported");
  }
  const params = request.params as Record<string, unknown> | undefined;
  const message = params?.message as Record<string, unknown> | undefined;
  const parts = message?.parts;
  if (!Array.isArray(parts)) return rpcError(request.id, -32602, "params.message.parts is required");
  const dataPart = parts.find((part) => part && typeof part === "object" && "data" in part) as Record<string, unknown> | undefined;
  const data = dataPart?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return rpcError(request.id, -32602, "A structured data part is required");

  try {
    const plan = createReferencePlan(category, data as Record<string, unknown>);
    return json({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: {
        kind: "message",
        role: "agent",
        messageId: crypto.randomUUID(),
        contextId: typeof message?.contextId === "string" ? message.contextId : crypto.randomUUID(),
        parts: [{ kind: "data", data: plan }],
      },
    });
  } catch (error) {
    return rpcError(request.id, -32602, error instanceof Error ? error.message : "Invalid inputs");
  }
}
