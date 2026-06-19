import { z } from "zod";
import { GameActionItemRefSchema } from "~/v0/game/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionTileRemoveSchema = z
	.object({
		targetItemInstanceId: IdSchema,
		toolRef: GameActionItemRefSchema,
		type: z.literal("tile.remove"),
	})
	.strict();

export type GameActionTileRemoveSchema = typeof GameActionTileRemoveSchema;

export namespace GameActionTileRemoveSchema {
	export type Type = z.infer<typeof GameActionTileRemoveSchema>;
}
