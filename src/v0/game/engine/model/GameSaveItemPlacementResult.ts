import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export type GameSaveItemPlacementResult =
	| {
			type: "placed";
			save: GameSave;
			events: GameEvent[];
	  }
	| {
			type: "blocked";
			reason: "placement_unavailable";
	  };
