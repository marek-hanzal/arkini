import { z } from "zod";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const MergeBoardItemsInputSchema = z.object({
	sourceBoardItemId: BoardItemIdSchema,
	targetBoardItemId: BoardItemIdSchema,
});
