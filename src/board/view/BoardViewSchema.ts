import { z } from "zod";
import { BoardCellSchema } from "~/play/schema/BoardCellSchema";
import { BoardViewItemSchema } from "./BoardViewItemSchema";

export const BoardViewSchema = z.object({
	items: z.array(BoardViewItemSchema),
	byId: z.record(z.string(), BoardViewItemSchema),
	byCellKey: z.record(z.string(), BoardViewItemSchema),
	firstEmptyCell: BoardCellSchema.optional(),
});

type BoardViewSchema = typeof BoardViewSchema;
export namespace BoardViewSchema {
	export type Type = z.infer<BoardViewSchema>;
}

export type BoardView = BoardViewSchema.Type;
