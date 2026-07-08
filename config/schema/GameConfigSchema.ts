import { z } from "zod";
import { AssetDefinitionSchema } from "./AssetDefinitionSchema";
import { GameMetaSchema } from "./GameMetaSchema";
import { ItemDefinitionSchema } from "./ItemDefinitionSchema";
import { StartingStateSchema } from "./StartingStateSchema";

export const GameConfigSchema = z.object({
	game: GameMetaSchema,
	assets: z.array(AssetDefinitionSchema).optional(),
	items: z.array(ItemDefinitionSchema),
	startingState: StartingStateSchema.optional(),
});
