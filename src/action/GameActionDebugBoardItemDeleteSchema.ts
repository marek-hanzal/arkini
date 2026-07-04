import { z } from "zod";

const IdSchema = z.string().min(1);

export const GameActionDebugBoardItemDeleteSchema = z
	.object({
		boardItemId: IdSchema,
		expectedItemId: IdSchema,
		type: z.literal("debug.board_item.delete"),
	})
	.strict();

export namespace GameActionDebugBoardItemDeleteSchema {
	export type Type = z.infer<typeof GameActionDebugBoardItemDeleteSchema>;
}
