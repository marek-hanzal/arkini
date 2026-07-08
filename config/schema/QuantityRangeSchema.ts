import { z } from "zod";
import { CountSchema } from "./CountSchema";

export const QuantityRangeSchema = z.object({
	min: CountSchema,
	max: CountSchema,
});
