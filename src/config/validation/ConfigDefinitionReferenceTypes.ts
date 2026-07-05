import type { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";

export type ConfigDefinitionReferenceContext = {
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasItem: (itemId: string) => boolean;
	hasResource: (resourceId: string) => boolean;
	itemIds: readonly string[];
	value: GameConfig;
};

export type ConfigItem = GameConfig["items"][string];
