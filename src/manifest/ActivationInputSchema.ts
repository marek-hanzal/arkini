import { z } from "zod";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";

export const ActivationInputSchema = z
	.array(
		z.object({
			itemId: GameItemIdSchema,
			quantity: PositiveIntegerSchema,
			capacity: PositiveIntegerSchema,
		}),
	)
	.optional();

type ActivationInputSchema = typeof ActivationInputSchema;
export namespace ActivationInputSchema {
	export type Type = z.infer<ActivationInputSchema>;
}
