import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export type GameSaveItemPlacementResult = {
	type: "placed";
	save: GameSave;
	events: GameEvent[];
};
