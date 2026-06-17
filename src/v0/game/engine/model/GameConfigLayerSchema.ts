import { z } from "zod";
import { GameConfigLayerProductSchema } from "~/v0/game/engine/model/GameConfigLayerProductSchema";

const IdSchema = z.string().min(1);

export const GameConfigLayerSchema = z
	.object({
		products: z.record(IdSchema, GameConfigLayerProductSchema),
	})
	.strict();

export type GameConfigLayerSchema = typeof GameConfigLayerSchema;

export namespace GameConfigLayerSchema {
	export type Type = z.infer<typeof GameConfigLayerSchema>;
}

export type GameConfigLayer = GameConfigLayerSchema.Type;
