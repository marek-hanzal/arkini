import { z } from "zod";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const SwapBoardItemsInputSchema = z.object({
	sourceBoardItemId: BoardItemIdSchema,
	targetBoardItemId: BoardItemIdSchema,
});

type SwapBoardItemsInputSchema = typeof SwapBoardItemsInputSchema;
export namespace SwapBoardItemsInputSchema {
	export type Type = z.infer<SwapBoardItemsInputSchema>;
}
