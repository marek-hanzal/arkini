import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";

type WorldRequirementStatus = "missing" | "ok" | "out_of_range" | "unsupported";

export interface WorldRequirementFacts {
	availableQuantity?: number;
	matchedDistance?: number;
	matchedItemInstanceId?: string;
	requiredDistance?: number;
	requiredQuantity?: number;
	requirement: GameRequirement;
	status: WorldRequirementStatus;
}
