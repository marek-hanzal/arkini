import { z } from "zod";
import { IdSchema } from "./IdSchema";
import { OutputSetSchema } from "./OutputSetSchema";
import { RemovalToolModeSchema } from "./RemovalToolModeSchema";

export const RemoveByRuleSchema = z.object({
	itemId: IdSchema,
	mode: RemovalToolModeSchema.optional(),
	output: z.array(OutputSetSchema).optional(),
});
