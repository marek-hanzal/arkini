import type { GamePassiveRequirementScope } from "~/v0/game/requirements/GamePassiveRequirementScope";

export type GameRequirement =
	| {
			type: "stored";
			itemId: string;
			quantity: number;
			capacity: number;
	  }
	| {
			type: "passive";
			itemId: string;
			quantity: number;
			scope: GamePassiveRequirementScope;
	  };
