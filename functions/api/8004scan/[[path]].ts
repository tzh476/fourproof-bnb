interface PagesContext {
  request: Request;
  params: { path?: string | string[] };
}

const upstreamOrigin = "https://api.8004scan.io";

function normalizePath(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join("/") : value ?? "";
}

function allowedPath(path: string): boolean {
  return path === "agents" || /^agents\/56\/\d+$/.test(path);
}

function safeQuery(input: URL): URLSearchParams {
  const output = new URLSearchParams();
  if (input.searchParams.has("chain_id")) output.set("chain_id", "56");

  const search = input.searchParams.get("search")?.trim().slice(0, 80);
  if (search) output.set("search", search);

  const requestedLimit = Number.parseInt(input.searchParams.get("limit") ?? "12", 10);
  output.set("limit", String(Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, requestedLimit)) : 12));
  return output;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const path = normalizePath(context.params.path);
  if (!allowedPath(path)) {
    return Response.json({ error: "Unsupported 8004scan route" }, { status: 404 });
  }

  const incoming = new URL(context.request.url);
  const upstream = new URL(`/api/v1/${path}`, upstreamOrigin);
  upstream.search = safeQuery(incoming).toString();

  const response = await fetch(upstream, {
    headers: { Accept: "application/json", "User-Agent": "FourProof/0.1" },
  });
  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "public, max-age=20, s-maxage=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function onRequest(): Promise<Response> {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET" } });
}
