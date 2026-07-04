import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionBoardMemoryActivateSchema = z
	.object({
		boardItemId: IdSchema,
		type: z.literal("board.memory.activate"),
	})
	.strict();

export namespace GameActionBoardMemoryActivateSchema {
	export type Type = z.infer<typeof GameActionBoardMemoryActivateSchema>;
}
