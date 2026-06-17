import { z } from "zod";

const NonNegativeIntegerSchema = z.number().int().min(0);

export const GameConfigLayerProductInputSchema = z
	.object({
		quantity: NonNegativeIntegerSchema,
	})
	.strict();

export type GameConfigLayerProductInputSchema = typeof GameConfigLayerProductInputSchema;

export namespace GameConfigLayerProductInputSchema {
	export type Type = z.infer<typeof GameConfigLayerProductInputSchema>;
}

export type GameConfigLayerProductInput = GameConfigLayerProductInputSchema.Type;
