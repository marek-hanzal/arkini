import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSave, GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";

export type CraftJobCompletionScope = {
	config: GameConfig;
	save: GameSave;
	job: GameSaveCraftJob;
	nowMs: number;
};

export type CraftCompletionTarget = {
	liveJob: GameSaveCraftJob;
	liveTarget: GameSaveBoardItem;
	recipe: GameCraftRecipeDefinition;
};
