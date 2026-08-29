import { describe, expect, it } from "vitest";
import { buildActivationPlan } from "./activation";
import { rankAgent } from "./scoring";
import { agentFixture } from "./test-fixtures";

const registryProof = {
  verified: true,
  owner: "0x1111111111111111111111111111111111111111" as const,
  tokenUri: "ipfs://agent-card",
  blockNumber: 123n,
  checkedAt: "2026-08-29T00:01:00Z",
};

describe("buildActivationPlan", () => {
  it("creates an explicitly read-only, non-custodial plan", () => {
    const ranked = rankAgent(agentFixture(), "rebalancing");
    const plan = buildActivationPlan(
      ranked,
      "Measure drift against the supplied target weights.",
      registryProof,
    );

    expect(plan.chainId).toBe(56);
    expect(plan.controls).toEqual({
      readOnly: true,
      noCustody: true,
      noTrading: true,
      expiresMinutes: 30,
    });
    expect(plan.discoveryUrl).toBe("https://agent.example/a2a");
    expect(plan.executionEndpoint).toBe("https://agent.example/a2a/messages");
    expect(plan.evidenceSnapshot.registryBlockNumber).toBe("123");
  });

  it("refuses to create a plan when an endpoint gate fails", () => {
    const ranked = rankAgent(agentFixture({ services: [] }), "rebalancing");

    expect(() => buildActivationPlan(ranked, "Measure current allocation drift safely.", registryProof)).toThrow(
      /evidence gates pass/,
    );
  });

  it("rejects vague or oversized objectives at the UI boundary", () => {
    const ranked = rankAgent(agentFixture(), "rebalancing");

    expect(() => buildActivationPlan(ranked, "rebalance", registryProof)).toThrow(/between 12 and 500/);
    expect(() => buildActivationPlan(ranked, "x".repeat(501), registryProof)).toThrow(/between 12 and 500/);
  });
});
