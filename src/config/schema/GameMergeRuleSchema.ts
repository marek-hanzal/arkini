import { z } from "zod";
import { IdSchema } from "~/config/schema/GameConfigScalarSchemas";

export const MergeRuleSchema = z
	.object({
		withItemId: IdSchema,
		resultItemId: IdSchema,
		secret: z.boolean().optional(),
	})
	.strict();
