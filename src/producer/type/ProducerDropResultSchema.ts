import { z } from "zod";
import { ProducerDepletionSchema } from "./ProducerDepletionSchema";
import { ProducerPlacementSchema } from "./ProducerPlacementSchema";

export const ProducerDropResultSchema = z.object({
	producerBoardItemId: z.string().min(1),
	placements: z.array(ProducerPlacementSchema),
	depletion: ProducerDepletionSchema.optional(),
});

type ProducerDropResultSchema = typeof ProducerDropResultSchema;
export namespace ProducerDropResultSchema {
	export type Type = z.infer<ProducerDropResultSchema>;
}

export type ProducerDropResult = ProducerDropResultSchema.Type;
