import { z } from "zod";
import { IdSchema } from "./IdSchema";
import { OutputSetSchema } from "./OutputSetSchema";
import { TargetModeSchema } from "./TargetModeSchema";

export const MergeEmitOutputSchema = z.object({
	type: z.literal("output"),
	withItemId: IdSchema,
	targetMode: TargetModeSchema.optional(),
	output: z.array(OutputSetSchema),
});
