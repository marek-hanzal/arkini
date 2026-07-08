import { z } from "zod";
import { IdSchema } from "./IdSchema";

export const MergeIntoItemSchema = z.object({
	type: z.literal("item"),
	withItemId: IdSchema,
	resultItemId: IdSchema,
});
