import { z } from "zod";

const PositiveIntegerSchema = z.number().int().positive();

export const GameConfigLayerProductInputSchema = z
	.object({
		quantity: PositiveIntegerSchema,
	})
	.strict();

export type GameConfigLayerProductInputSchema = typeof GameConfigLayerProductInputSchema;

export namespace GameConfigLayerProductInputSchema {
	export type Type = z.infer<typeof GameConfigLayerProductInputSchema>;
}

export type GameConfigLayerProductInput = GameConfigLayerProductInputSchema.Type;
