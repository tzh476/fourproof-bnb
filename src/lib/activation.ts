import { strongestService } from "./scoring";
import type { RankedAgent, RegistryProof } from "./types";

export interface ActivationPlan {
  version: "fourproof.activation.v1";
  chainId: 56;
  agentTokenId: string;
  agentOwner: `0x${string}`;
  discoveryUrl: string;
  executionEndpoint: string;
  category: RankedAgent["category"];
  objective: string;
  controls: {
    readOnly: true;
    noCustody: true;
    noTrading: true;
    expiresMinutes: number;
  };
  evidenceSnapshot: {
    evidenceTier: RankedAgent["evidenceTier"];
    evidenceScore: number;
    endpointCheckedAt: string | null;
    registryCheckedAt: string;
    registryBlockNumber: string;
  };
}

export function buildActivationPlan(
  agent: RankedAgent,
  objective: string,
  registryProof: RegistryProof | null,
): ActivationPlan {
  const trimmedObjective = objective.trim();
  if (trimmedObjective.length < 12 || trimmedObjective.length > 500) {
    throw new Error("Objective must be between 12 and 500 characters");
  }
  const service = strongestService(agent.services);
  if (
    agent.evidenceTier !== "operational" ||
    agent.activationBlockedReasons.length > 0 ||
    !service?.endpoint ||
    !service.executionEndpoint ||
    !registryProof?.verified ||
    registryProof.owner.toLowerCase() !== agent.ownerAddress.toLowerCase()
  ) {
    throw new Error("Activation is blocked until the evidence gates pass");
  }

  return {
    version: "fourproof.activation.v1",
    chainId: 56,
    agentTokenId: agent.tokenId,
    agentOwner: agent.ownerAddress,
    discoveryUrl: service.endpoint,
    executionEndpoint: service.executionEndpoint,
    category: agent.category,
    objective: trimmedObjective,
    controls: {
      readOnly: true,
      noCustody: true,
      noTrading: true,
      expiresMinutes: 30,
    },
    evidenceSnapshot: {
      evidenceTier: agent.evidenceTier,
      evidenceScore: agent.evidenceScore,
      endpointCheckedAt: service.checkedAt,
      registryCheckedAt: registryProof.checkedAt,
      registryBlockNumber: registryProof.blockNumber.toString(),
    },
  };
}
