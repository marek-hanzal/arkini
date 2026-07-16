import { z } from "zod";
import { BoardCellSchema } from "~/board/schema/BoardCellSchema";
import { BoardViewItemSchema } from "./BoardViewItemSchema";

const BoardViewSchema = z.object({
	items: z.array(BoardViewItemSchema),
	byId: z.record(z.string(), BoardViewItemSchema),
	byCellKey: z.record(z.string(), BoardViewItemSchema),
	firstEmptyCell: BoardCellSchema.optional(),
});

export type BoardView = z.infer<typeof BoardViewSchema>;
