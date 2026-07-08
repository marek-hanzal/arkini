import { z } from "zod";
import { DurationMsSchema } from "./DurationMsSchema";
import { IdSchema } from "./IdSchema";

export const TimedStatusSchema = z.object({
	id: IdSchema,
	name: z.string().optional(),
	durationMs: DurationMsSchema,
	facts: z.array(IdSchema),
});
