import { z } from "zod";
import { validateGameConfig } from "~/v0/game/config/validation/GameConfigValidation";
import { AssetFragmentSchema, AssetSchema } from "~/v0/game/config/schema/GameAssetSchema";
import { IdSchema } from "~/v0/game/config/schema/GameConfigScalarSchemas";
import { GameMetaSchema } from "~/v0/game/config/schema/GameMetaSchema";
import { ItemFragmentSchema, ItemSchema } from "~/v0/game/config/schema/GameItemSchema";
import { ResourceSchema } from "~/v0/game/config/schema/GameResourceSchema";
import { StartingStateSchema } from "~/v0/game/config/schema/GameStartingStateSchema";

const GameConfigFragmentSchema = z
	.object({
		version: z.literal(1).optional(),
		game: GameMetaSchema.optional(),
		resources: z.record(IdSchema, ResourceSchema).optional(),
		assets: z.record(IdSchema, AssetFragmentSchema).optional(),
		items: z.record(IdSchema, ItemFragmentSchema).optional(),
		startingState: StartingStateSchema.optional(),
	})
	.strict();

const BaseGameConfigSchema = z
	.object({
		version: z.literal(1),
		game: GameMetaSchema,
		resources: z.record(IdSchema, ResourceSchema),
		assets: z.record(IdSchema, AssetSchema),
		items: z.record(IdSchema, ItemSchema),
		startingState: StartingStateSchema,
	})
	.strict();

export const GameConfigSchema = BaseGameConfigSchema.superRefine(validateGameConfig);

export type { GameConfig } from "~/v0/game/config/GameConfigTypes";
export type GameConfigFragment = z.infer<typeof GameConfigFragmentSchema>;

export const parseGameConfigFragment = (value: unknown) => GameConfigFragmentSchema.parse(value);
export const parseGameConfig = (value: unknown) => GameConfigSchema.parse(value);
