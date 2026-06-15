import { z } from "zod";
import { MergeBoardItemsInputSchema } from "~/play/schema/MergeBoardItemsInputSchema";

export const BoardMergeCommandSchema = MergeBoardItemsInputSchema.extend({
	type: z.literal("board.merge"),
});

type BoardMergeCommandSchema = typeof BoardMergeCommandSchema;
export namespace BoardMergeCommandSchema {
	export type Type = z.infer<BoardMergeCommandSchema>;
}
