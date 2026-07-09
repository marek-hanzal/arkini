import type { GameActionBoardMemoryActivateSchema } from "~/action/GameActionBoardMemoryActivateSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export interface BoardMemoryActivationProps {
	action: GameActionBoardMemoryActivateSchema.Type;
	config: GameConfig;
	nowMs: number;
	save: GameSave;
}

export interface BoardMemoryActivationState {
	events: GameEvent[];
	nextSave: GameSave;
}

export type BoardMemoryLayoutItem = GameSave["boardMemoryLayouts"][string]["items"][number];
