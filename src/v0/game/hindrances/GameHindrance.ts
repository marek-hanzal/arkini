import type { GamePassiveRequirementScope } from "~/v0/game/requirements/GamePassiveRequirementScope";

export type GameHindrance =
	| {
			type: "passive";
			itemId: string;
			quantity: number;
			scope: GamePassiveRequirementScope;
			durationFactor?: number;
	  }
	| {
			type: "proximity";
			itemIds: string[];
			distance: number;
			durationFactor?: number;
	  };
