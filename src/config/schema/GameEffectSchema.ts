import { z } from "zod";
import { IdSchema } from "~/config/schema/GameConfigScalarSchemas";
import {
	GameEffectPolaritySchema,
	GameEffectSourceScopeSchema,
} from "~/config/schema/GameLineEffectSchema";

const GameEffectGrantSchema = z
	.object({
		id: IdSchema,
		name: z.string().min(1),
	})
	.strict();

export const GameEffectSchema = z
	.object({
		id: IdSchema,
		name: z.string().min(1),
		polarity: GameEffectPolaritySchema,
		grants: z.array(GameEffectGrantSchema).min(1),
		sourceScope: GameEffectSourceScopeSchema.optional(),
	})
	.strict();
