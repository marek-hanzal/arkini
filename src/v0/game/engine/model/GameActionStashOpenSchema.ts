import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/engine/model/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionStashOpenSchema = z
	.object({
		inputRefs: z.array(GameActionItemRefSchema),
		stashItemInstanceId: IdSchema,
		type: z.literal("stash.open"),
	})
	.strict();

export type GameActionStashOpenSchema = typeof GameActionStashOpenSchema;

export namespace GameActionStashOpenSchema {
	export type Type = z.infer<typeof GameActionStashOpenSchema>;
}
