import { z } from "zod";
import { IdSchema } from "~/v0/game/config/schema/GameConfigScalarSchemas";
import {
	GameEffectPolaritySchema,
	GameEffectSourceScopeSchema,
} from "~/v0/game/config/schema/GameLineEffectSchema";

export const GameEffectGrantDefinitionSchema = z
	.object({
		id: IdSchema,
		name: z.string().min(1),
	})
	.strict();

export const GameEffectDefinitionSchema = z
	.object({
		name: z.string().min(1),
		polarity: GameEffectPolaritySchema,
		grants: z.array(GameEffectGrantDefinitionSchema).min(1),
		sourceScope: GameEffectSourceScopeSchema.optional(),
	})
	.strict();

export const GameEffectAuthoringDefinitionSchema = GameEffectDefinitionSchema;
