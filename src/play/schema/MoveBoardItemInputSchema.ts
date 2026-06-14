import { z } from "zod";
import { BoardCellSchema } from "./BoardCellSchema";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const MoveBoardItemInputSchema = z.object({
	boardItemId: BoardItemIdSchema,
	...BoardCellSchema.shape,
});
