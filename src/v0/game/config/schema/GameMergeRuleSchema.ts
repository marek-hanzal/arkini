import { z } from "zod";
import { IdSchema } from "~/v0/game/config/schema/GameConfigScalarSchemas";

export const MergeRuleSchema = z
	.object({
		withItemId: IdSchema,
		resultItemId: IdSchema,
		secret: z.boolean().optional(),
	})
	.strict();
