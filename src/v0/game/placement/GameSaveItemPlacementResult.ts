import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export type GameSaveItemPlacementResult = {
	type: "placed";
	save: GameSave;
	events: GameEvent[];
};
