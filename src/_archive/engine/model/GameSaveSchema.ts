import { z } from "zod";
import { GameConfigSchema } from "~/config/GameConfigSchema";
import { GameSaveSchema as GameSaveShapeSchema } from "~/engine/model/GameSaveShapeSchema";
import { validateGameSaveAgainstConfig } from "~/engine/model/validateGameSaveAgainstConfig";

export const GameSaveConfigSchema = z
	.object({
		config: GameConfigSchema,
		save: GameSaveShapeSchema,
	})
	.strict()
	.superRefine(({ config, save }, ctx) => {
		validateGameSaveAgainstConfig(ctx, save, config);
	});

export type {
	GameSave,
	GameSaveBoardItem,
	GameSaveCraftJob,
	GameSaveInventoryInstance,
	GameSaveInventorySlot,
	GameSaveInventoryStack,
	GameSaveItemSpawnJob,
	GameSaveProducerJob,
} from "~/engine/model/GameSaveShapeSchema";
