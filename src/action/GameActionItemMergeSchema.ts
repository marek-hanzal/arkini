import { z } from "zod";
import { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionItemMergeSchema = z
	.object({
		sourceRef: GameActionItemRefSchema,
		targetItemInstanceId: IdSchema,
		type: z.literal("item.merge"),
	})
	.strict();

export type GameActionItemMergeSchema = typeof GameActionItemMergeSchema;

export namespace GameActionItemMergeSchema {
	export type Type = z.infer<typeof GameActionItemMergeSchema>;
}
