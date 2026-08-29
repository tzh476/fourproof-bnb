import { describe, expect, it } from "vitest";
import { createReferencePlan } from "./reference-agents";

describe("reference agents", () => {
  it("bounds a rebalancing plan", () => {
    const plan = createReferencePlan("rebalancing", { currentWeightPct: 35, targetWeightPct: 40, portfolioUsd: 10_000, maxTurnoverPct: 8 });
    expect(plan.decision).toBe("plan");
    expect(plan.metrics.notionalUsd).toBe(500);
  });

  it("rejects a grid whose spacing does not clear fees", () => {
    const plan = createReferencePlan("grid-trading", { lowerPrice: 100, upperPrice: 101, levels: 20, feeBps: 30, maxLossPct: 5 });
    expect(plan.decision).toBe("reject");
  });

  it("ranks only supplied yield observations", () => {
    const plan = createReferencePlan("yield-optimisation", { venues: [{ name: "A", aprPct: 3 }, { name: "B", aprPct: 5 }], maxAllocationPct: 40 });
    expect(plan.actions[0]).toContain("B");
    expect(plan.warnings[0]).toMatch(/not independently verified/);
  });

  it("computes a stressed health-factor rejection and repayment", () => {
    const plan = createReferencePlan("health-factor", { collateralUsd: 1_000, borrowUsd: 700, liquidationThresholdPct: 80, stressPct: 20, targetHealthFactor: 1.25 });
    expect(plan.decision).toBe("reject");
    expect(plan.metrics.minimumRepayUsd).toBe(188);
  });

  it("rejects malformed values at the boundary", () => {
    expect(() => createReferencePlan("rebalancing", { currentWeightPct: "35" })).toThrow();
  });
});
