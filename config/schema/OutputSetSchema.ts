import { z } from "zod";
import { OutputEntrySchema } from "./OutputEntrySchema";

export const OutputSetSchema = z.object({
	weight: z.number().positive().optional(),
	entries: z.array(OutputEntrySchema),
});
