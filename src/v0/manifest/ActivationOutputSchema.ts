import { z } from "zod";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";
import { QuantitySchema } from "./QuantitySchema";

export const ActivationOutputSchema = z
	.array(
		z.discriminatedUnion("type", [
			z.object({
				type: z.literal("guaranteed"),
				itemId: GameItemIdSchema,
				quantity: QuantitySchema.optional(),
			}),
			z.object({
				type: z.literal("chance"),
				itemId: GameItemIdSchema,
				probability: z.number().min(0).max(1),
				quantity: QuantitySchema.optional(),
			}),
			z.object({
				type: z.literal("weighted"),
				rolls: QuantitySchema.optional(),
				entries: z
					.array(
						z.object({
							itemId: GameItemIdSchema,
							weight: PositiveIntegerSchema,
							quantity: QuantitySchema.optional(),
						}),
					)
					.min(1),
			}),
		]),
	)
	.min(1);

type ActivationOutputSchema = typeof ActivationOutputSchema;
export namespace ActivationOutputSchema {
	export type Type = z.infer<ActivationOutputSchema>;
}
