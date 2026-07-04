import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionBoardItemStashSchema = z
	.object({
		boardItemId: IdSchema,
		type: z.literal("board.item.stash"),
	})
	.strict();

export namespace GameActionBoardItemStashSchema {
	export type Type = z.infer<typeof GameActionBoardItemStashSchema>;
}
