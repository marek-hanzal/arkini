import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionBoardMemoryClearSchema = z
	.object({
		boardItemId: IdSchema,
		type: z.literal("board.memory.clear"),
	})
	.strict();

export type GameActionBoardMemoryClearSchema = typeof GameActionBoardMemoryClearSchema;

export namespace GameActionBoardMemoryClearSchema {
	export type Type = z.infer<typeof GameActionBoardMemoryClearSchema>;
}
