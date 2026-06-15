import { z } from "zod";
import { MoveBoardItemInputSchema } from "~/play/schema/MoveBoardItemInputSchema";

export const BoardMoveCommandSchema = MoveBoardItemInputSchema.extend({
	type: z.literal("board.move"),
});

type BoardMoveCommandSchema = typeof BoardMoveCommandSchema;
export namespace BoardMoveCommandSchema {
	export type Type = z.infer<BoardMoveCommandSchema>;
}
