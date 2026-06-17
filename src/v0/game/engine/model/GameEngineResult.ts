import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export interface GameEngineResult {
	save: GameSave;
	events: GameEvent[];
}
