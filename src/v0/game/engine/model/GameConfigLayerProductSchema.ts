import { z } from "zod";
import { GameConfigLayerProductInputSchema } from "~/v0/game/engine/model/GameConfigLayerProductInputSchema";

const IdSchema = z.string().min(1);
const PositiveIntegerSchema = z.number().int().positive();

export const GameConfigLayerProductSchema = z
	.object({
		durationMs: PositiveIntegerSchema.optional(),
		inputRefId: IdSchema.optional(),
		inputs: z.record(IdSchema, GameConfigLayerProductInputSchema).optional(),
		outputTableId: IdSchema.optional(),
	})
	.strict();

export type GameConfigLayerProductSchema = typeof GameConfigLayerProductSchema;

export namespace GameConfigLayerProductSchema {
	export type Type = z.infer<typeof GameConfigLayerProductSchema>;
}

export type GameConfigLayerProduct = GameConfigLayerProductSchema.Type;
