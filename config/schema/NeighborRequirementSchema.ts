import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { ItemMatcherSchema } from "./ItemMatcherSchema";
import { NeighborDirectionSchema } from "./NeighborDirectionSchema";

export const NeighborRequirementSchema = z.object({
	direction: NeighborDirectionSchema,
	items: ItemMatcherSchema,
	minCount: CountSchema.optional(),
});
