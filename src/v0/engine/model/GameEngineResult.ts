import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export interface GameEngineResult {
	save: GameSave;
	events: GameEvent[];
	nextWakeAtMs: number | null;
}
