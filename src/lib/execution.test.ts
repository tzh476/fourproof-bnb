import { describe, expect, it, vi } from "vitest";
import { applyExecutionReceipt, runBoundedA2AProbe } from "./execution";
import { rankAgent } from "./scoring";
import { agentFixture } from "./test-fixtures";

const registry = "eip155:56:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

function probeCandidate(cardUrl = "https://agent.example/agents/10/agent-card.json") {
  return rankAgent(
    agentFixture({
      tokenId: "42",
      services: [
        {
          name: "a2a",
          endpoint: cardUrl,
          executionEndpoint: null,
          executionTargetVerified: false,
          executionIdentityVerified: false,
          executionCheckedAt: null,
          status: "healthy",
          message: "Valid A2A AgentCard",
          checkedAt: "2026-08-29T00:00:00Z",
          domainVerified: false,
        },
      ],
    }),
    "rebalancing",
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("runBoundedA2AProbe", () => {
  it("promotes an agent only after the live response binds token, wallet, and registry", async () => {
    const candidate = probeCandidate();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          name: "Measured Portfolio Rebalancer",
          url: "https://agent.example/api/a2a",
          registrations: [
            { agentId: 10, agentRegistry: "eip155:56:0x039d7d0096d2989647133f9676f2b341e602d2ff" },
            { agentId: 42, agentRegistry: registry },
          ],
        }),
      )
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(String(init.body)) as { id: string };
        return jsonResponse({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            kind: "message",
            messageId: "remote-1",
            role: "agent",
            parts: [
              { kind: "text", text: "Read-only capability response." },
              {
                kind: "data",
                data: {
                  erc8004AgentId: "42",
                  agentWallet: "eip155:56:0x2222222222222222222222222222222222222222",
                  registrations: [{ agentId: "42", agentRegistry: registry }],
                  skills: [{ id: "market-cap-index", name: "Portfolio index", description: "Portfolio allocation", tags: ["index"] }],
                },
              },
            ],
          },
        });
      });

    const receipt = await runBoundedA2AProbe(candidate, fetcher);
    const upgraded = applyExecutionReceipt(candidate, receipt);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(receipt.controls).toEqual({
      readOnly: true,
      noWallet: true,
      noAuth: true,
      noCustody: true,
      noTrading: true,
    });
    expect(upgraded.evidenceTier).toBe("operational");
    expect(upgraded.activationBlockedReasons).toEqual([]);
  });

  it("rejects localhost or plaintext execution targets before sending a message", async () => {
    const candidate = probeCandidate();
    const fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        name: "Unsafe card",
        url: "http://127.0.0.1:9101/",
        registrations: [{ agentId: 42, agentRegistry: registry }],
      }),
    );

    await expect(
      runBoundedA2AProbe(candidate, fetcher),
    ).rejects.toThrow(/safe public HTTPS target/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a private discovery target before making any request", async () => {
    const candidate = probeCandidate("https://localhost/agent-card.json");
    const fetcher = vi.fn();

    await expect(
      runBoundedA2AProbe(candidate, fetcher),
    ).rejects.toThrow(/discovery URL is not a safe public HTTPS target/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a response that claims a different ERC-8004 identity", async () => {
    const candidate = probeCandidate();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          name: "Wrong identity",
          url: "https://agent.example/api/a2a",
          registrations: [{ agentId: 42, agentRegistry: registry }],
        }),
      )
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(String(init.body)) as { id: string };
        return jsonResponse({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            kind: "message",
            messageId: "remote-2",
            role: "agent",
            parts: [
              {
                kind: "data",
                data: {
                  erc8004AgentId: "99",
                  agentWallet: "eip155:56:0x2222222222222222222222222222222222222222",
                  registrations: [{ agentId: "99", agentRegistry: registry }],
                },
              },
            ],
          },
        });
      });

    await expect(
      runBoundedA2AProbe(candidate, fetcher),
    ).rejects.toThrow(/different ERC-8004 token/);
  });
});
