import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export interface GameAudioPlanProps {
	config: GameConfig;
	currentSave: GameSave;
	events: readonly GameEvent[];
	previousSave: GameSave;
}
