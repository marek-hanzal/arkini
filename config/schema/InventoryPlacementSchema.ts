import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { IdSchema } from "./IdSchema";

export const InventoryPlacementSchema = z.object({
	itemId: IdSchema,
	quantity: CountSchema.optional(),
});
