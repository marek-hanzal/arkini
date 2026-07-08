import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { ItemMatcherSchema } from "./ItemMatcherSchema";
import { NeighborDirectionSchema } from "./NeighborDirectionSchema";

export const NeighborCapacitySpendSchema = z.object({
	items: ItemMatcherSchema,
	direction: NeighborDirectionSchema,
	amount: CountSchema,
});
