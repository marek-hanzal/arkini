import { z } from "zod";

const PositiveIntegerSchema = z.number().int().positive();

export const GameConfigLayerProducerSchema = z
	.object({
		maxQueueSize: PositiveIntegerSchema.optional(),
	})
	.strict();

export type GameConfigLayerProducerSchema = typeof GameConfigLayerProducerSchema;

export namespace GameConfigLayerProducerSchema {
	export type Type = z.infer<typeof GameConfigLayerProducerSchema>;
}

export type GameConfigLayerProducer = GameConfigLayerProducerSchema.Type;
