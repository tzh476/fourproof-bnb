import type { AgentCategory } from "./types";

type NumericMap = Record<string, number>;

export interface ReferencePlan {
  category: AgentCategory;
  decision: "plan" | "reject";
  metrics: NumericMap;
  actions: string[];
  warnings: string[];
  controls: { readOnly: true; noCustody: true; noTrading: true };
}

function finite(value: unknown, name: string, min = 0, max = 1e12): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a finite number between ${min} and ${max}`);
  }
  return value;
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function base(category: AgentCategory): Pick<ReferencePlan, "category" | "controls"> {
  return { category, controls: { readOnly: true, noCustody: true, noTrading: true } };
}

export function createReferencePlan(category: AgentCategory, input: Record<string, unknown>): ReferencePlan {
  if (category === "rebalancing") {
    const current = finite(input.currentWeightPct, "currentWeightPct", 0, 100);
    const target = finite(input.targetWeightPct, "targetWeightPct", 0, 100);
    const portfolio = finite(input.portfolioUsd, "portfolioUsd", 1);
    const maxTurnover = finite(input.maxTurnoverPct, "maxTurnoverPct", 0, 100);
    const deltaPct = target - current;
    const requiredTurnoverPct = Math.abs(deltaPct);
    const allowed = requiredTurnoverPct <= maxTurnover;
    return {
      ...base(category),
      decision: allowed ? "plan" : "reject",
      metrics: { deltaPct: round(deltaPct), requiredTurnoverPct: round(requiredTurnoverPct), notionalUsd: round(portfolio * requiredTurnoverPct / 100, 2) },
      actions: allowed ? [`${deltaPct >= 0 ? "Increase" : "Decrease"} the target asset by ${round(requiredTurnoverPct)} percentage points.`] : [],
      warnings: allowed ? ["Single-asset drift check; all other weights must be revalidated before execution."] : ["Required turnover exceeds the supplied cap."],
    };
  }

  if (category === "grid-trading") {
    const lower = finite(input.lowerPrice, "lowerPrice", 0.00000001);
    const upper = finite(input.upperPrice, "upperPrice", lower);
    const levels = Math.trunc(finite(input.levels, "levels", 2, 200));
    const feeBps = finite(input.feeBps, "feeBps", 0, 1_000);
    const maxLossPct = finite(input.maxLossPct, "maxLossPct", 0, 100);
    const spacingPct = (Math.pow(upper / lower, 1 / (levels - 1)) - 1) * 100;
    const roundTripCostPct = feeBps * 2 / 100;
    const allowed = spacingPct > roundTripCostPct && maxLossPct > 0;
    return {
      ...base(category),
      decision: allowed ? "plan" : "reject",
      metrics: { spacingPct: round(spacingPct), roundTripCostPct: round(roundTripCostPct), levels, maxLossPct },
      actions: allowed ? [`Model ${levels} geometric levels between ${lower} and ${upper}; do not place orders automatically.`] : [],
      warnings: allowed ? ["Slippage, gas, transfer taxes, and volatility are not included."] : ["Grid spacing does not clear the supplied round-trip fee or loss cap."],
    };
  }

  if (category === "yield-optimisation") {
    const supplied = input.venues;
    if (!Array.isArray(supplied) || supplied.length < 2 || supplied.length > 20) {
      throw new Error("venues must contain between 2 and 20 entries");
    }
    const venues = supplied.map((venue, index) => {
      if (!venue || typeof venue !== "object") throw new Error(`venues[${index}] must be an object`);
      const record = venue as Record<string, unknown>;
      if (typeof record.name !== "string" || record.name.trim().length === 0 || record.name.length > 80) {
        throw new Error(`venues[${index}].name is invalid`);
      }
      return { name: record.name.trim(), aprPct: finite(record.aprPct, `venues[${index}].aprPct`, -100, 10_000) };
    });
    const maxAllocationPct = finite(input.maxAllocationPct, "maxAllocationPct", 1, 100);
    const ranked = [...venues].sort((a, b) => b.aprPct - a.aprPct);
    return {
      ...base(category),
      decision: "plan",
      metrics: { bestAprPct: ranked[0].aprPct, spreadPct: round(ranked[0].aprPct - ranked[1].aprPct), maxAllocationPct },
      actions: [`Rank ${ranked[0].name} first using the supplied APR, capped at ${maxAllocationPct}% allocation.`],
      warnings: ["Supplied APR is not independently verified; smart-contract, liquidity, lockup, and reward-token risks remain."],
    };
  }

  const collateral = finite(input.collateralUsd, "collateralUsd", 0.01);
  const borrow = finite(input.borrowUsd, "borrowUsd", 0.01);
  const thresholdPct = finite(input.liquidationThresholdPct, "liquidationThresholdPct", 0.01, 100);
  const stressPct = finite(input.stressPct, "stressPct", 0, 99.99);
  const targetHealthFactor = finite(input.targetHealthFactor, "targetHealthFactor", 1, 10);
  const stressedCollateral = collateral * (1 - stressPct / 100);
  const healthFactor = collateral * thresholdPct / 100 / borrow;
  const stressedHealthFactor = stressedCollateral * thresholdPct / 100 / borrow;
  const repayUsd = Math.max(0, borrow - stressedCollateral * thresholdPct / 100 / targetHealthFactor);
  return {
    ...base(category),
    decision: stressedHealthFactor >= 1 ? "plan" : "reject",
    metrics: { healthFactor: round(healthFactor), stressedHealthFactor: round(stressedHealthFactor), minimumRepayUsd: round(repayUsd, 2), stressPct },
    actions: repayUsd > 0 ? [`Repay at least ${round(repayUsd, 2)} USD-equivalent to reach the supplied stressed target.`] : ["No repayment is indicated by the supplied snapshot."],
    warnings: ["Inputs are user supplied; verify protocol oracle values and liquidation rules onchain."],
  };
}
