import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionBoardItemsSwapSchema = z
	.object({
		sourceBoardItemId: IdSchema,
		targetBoardItemId: IdSchema,
		type: z.literal("board.items.swap"),
	})
	.strict();

export type GameActionBoardItemsSwapSchema = typeof GameActionBoardItemsSwapSchema;

export namespace GameActionBoardItemsSwapSchema {
	export type Type = z.infer<typeof GameActionBoardItemsSwapSchema>;
}
