import { z } from "zod";
import { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";

const IdSchema = z.string().min(1);

export const GameActionTileRemoveSchema = z
	.object({
		targetItemInstanceId: IdSchema,
		toolRef: GameActionItemRefSchema,
		type: z.literal("tile.remove"),
	})
	.strict();

export namespace GameActionTileRemoveSchema {
	export type Type = z.infer<typeof GameActionTileRemoveSchema>;
}
