import { z } from "zod";
import { SwapBoardItemsInputSchema } from "~/play/schema/SwapBoardItemsInputSchema";

export const BoardSwapCommandSchema = SwapBoardItemsInputSchema.extend({
	type: z.literal("board.swap"),
});

type BoardSwapCommandSchema = typeof BoardSwapCommandSchema;
export namespace BoardSwapCommandSchema {
	export type Type = z.infer<BoardSwapCommandSchema>;
}
