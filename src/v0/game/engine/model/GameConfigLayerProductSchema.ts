import { z } from "zod";
import { GameConfigLayerProductInputSchema } from "~/v0/game/engine/model/GameConfigLayerProductInputSchema";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);

export const GameConfigLayerProductSchema = z
	.object({
		durationMs: NonNegativeIntegerSchema.optional(),
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
