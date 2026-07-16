import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSaveBoardItem, GameSaveCraftJob } from "~/engine/model/GameSaveSchema";

export type CraftCompletionTarget = {
	liveJob: GameSaveCraftJob;
	liveTarget: GameSaveBoardItem;
	recipe: GameCraftRecipeDefinition;
};
