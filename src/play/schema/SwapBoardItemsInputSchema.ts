import { z } from "zod";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const SwapBoardItemsInputSchema = z.object({
	sourceBoardItemId: BoardItemIdSchema,
	targetBoardItemId: BoardItemIdSchema,
});
