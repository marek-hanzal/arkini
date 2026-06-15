import { z } from "zod";
import { BoardItemIdSchema } from "./BoardItemIdSchema";

export const MergeBoardItemsInputSchema = z.object({
	sourceBoardItemId: BoardItemIdSchema,
	targetBoardItemId: BoardItemIdSchema,
});

type MergeBoardItemsInputSchema = typeof MergeBoardItemsInputSchema;
export namespace MergeBoardItemsInputSchema {
	export type Type = z.infer<MergeBoardItemsInputSchema>;
}
