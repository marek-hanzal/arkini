import { z } from "zod";
import { CountSchema } from "./CountSchema";
import { IdSchema } from "./IdSchema";
import { IntegerSchema } from "./IntegerSchema";

export const BoardPlacementSchema = z.object({
	itemId: IdSchema,
	x: IntegerSchema,
	y: IntegerSchema,
	quantity: CountSchema.optional(),
});
