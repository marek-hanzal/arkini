import { z } from "zod";
import {
	IdSchema,
	NonNegativeIntegerSchema,
	PositiveIntegerSchema,
} from "~/config/schema/GameConfigScalarSchemas";

export const StartingStateSchema = z
	.object({
		inventory: z.array(
			z
				.object({
					itemId: IdSchema,
					quantity: PositiveIntegerSchema,
				})
				.strict(),
		),
		board: z.array(
			z
				.object({
					itemId: IdSchema,
					x: NonNegativeIntegerSchema,
					y: NonNegativeIntegerSchema,
				})
				.strict(),
		),
	})
	.strict();
