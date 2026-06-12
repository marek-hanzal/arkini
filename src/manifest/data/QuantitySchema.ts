import { z } from "zod";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";

export const QuantitySchema = z.union([
	PositiveIntegerSchema,
	z
		.object({
			min: PositiveIntegerSchema,
			max: PositiveIntegerSchema,
		})
		.refine((value) => value.max >= value.min, {
			message: "max must be >= min",
		}),
]);
