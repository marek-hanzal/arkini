import { z } from "zod";

const IdSchema = z.string().min(1);
const NonNegativeIntegerSchema = z.number().int().min(0);

export const GameActionBoardItemMoveSchema = z
	.object({
		boardItemId: IdSchema,
		type: z.literal("board.item.move"),
		x: NonNegativeIntegerSchema,
		y: NonNegativeIntegerSchema,
	})
	.strict();

export namespace GameActionBoardItemMoveSchema {
	export type Type = z.infer<typeof GameActionBoardItemMoveSchema>;
}
