import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { ProducerLineSchema } from "./ProducerLineSchema";

export const ProducerSchema = z.object({
	maxQueueSize: CountSchema.optional(),
	lines: z.array(ProducerLineSchema),
});
