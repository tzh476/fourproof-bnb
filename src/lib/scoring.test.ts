import { describe, expect, it } from "vitest";
import { rankAgent } from "./scoring";
import { agentFixture } from "./test-fixtures";

describe("rankAgent", () => {
  it("grants operational status only when identity, protocol, endpoint, and wallet evidence exist", () => {
    const ranked = rankAgent(agentFixture(), "rebalancing");

    expect(ranked.evidenceTier).toBe("operational");
    expect(ranked.activationBlockedReasons).toEqual([]);
    expect(ranked.evidenceScore).toBeGreaterThanOrEqual(75);
  });

  it("does not turn a strong description into operational evidence", () => {
    const ranked = rankAgent(
      agentFixture({
        name: "Perfect Grid Trading Agent",
        description: "Grid trading with flawless returns, instant activation, and perfect security.",
        supportedProtocols: [],
        agentWallet: null,
        services: [],
      }),
      "grid-trading",
    );

    expect(ranked.relevanceScore).toBeGreaterThan(0);
    expect(ranked.evidenceTier).toBe("registered");
    expect(ranked.activationBlockedReasons).toContain("No A2A or MCP protocol is advertised");
    expect(ranked.activationBlockedReasons).toContain("No A2A or MCP discovery URL is published");
  });

  it("blocks an advertised endpoint when the scanner reports it unhealthy", () => {
    const ranked = rankAgent(
      agentFixture({
        services: [
          {
            name: "a2a",
            endpoint: "https://broken.example/a2a",
            executionEndpoint: null,
            executionTargetVerified: false,
            executionIdentityVerified: false,
            executionCheckedAt: null,
            status: "unhealthy",
            message: "Invalid AgentCard",
            checkedAt: "2026-08-29T00:00:00Z",
            domainVerified: false,
          },
        ],
      }),
      "rebalancing",
    );

    expect(ranked.evidenceTier).toBe("registered");
    expect(ranked.activationBlockedReasons).toContain("Published service metadata is not currently reachable");
  });

  it("keeps a healthy AgentCard below operational until its execution target is verified", () => {
    const ranked = rankAgent(
      agentFixture({
        services: [
          {
            ...agentFixture().services[0],
            executionEndpoint: "http://127.0.0.1:9101/",
            executionTargetVerified: false,
            executionIdentityVerified: false,
            executionCheckedAt: null,
          },
        ],
      }),
      "rebalancing",
    );

    expect(ranked.evidenceTier).toBe("reachable");
    expect(ranked.activationBlockedReasons).toContain(
      "The execution target has not passed a bounded public-call check",
    );
  });

  it("rejects identities indexed under another chain", () => {
    const ranked = rankAgent(agentFixture({ chainId: 8453 }), "rebalancing");

    expect(ranked.evidenceTier).toBe("metadata-only");
    expect(ranked.activationBlockedReasons[0]).toMatch(/canonical BSC registry/);
  });
});
