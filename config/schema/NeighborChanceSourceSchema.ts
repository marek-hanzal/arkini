import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { ItemMatcherSchema } from "./ItemMatcherSchema";
import { NeighborDirectionSchema } from "./NeighborDirectionSchema";
import { ProbabilitySchema } from "./ProbabilitySchema";

export const NeighborChanceSourceSchema = z.object({
	items: ItemMatcherSchema,
	direction: NeighborDirectionSchema,
	chance: ProbabilitySchema,
	maxCount: CountSchema.optional(),
});
