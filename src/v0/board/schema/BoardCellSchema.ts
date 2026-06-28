import { z } from "zod";
import { BoardCoordinateSchema } from "./BoardCoordinateSchema";

export const BoardCellSchema = z.object({
	x: BoardCoordinateSchema,
	y: BoardCoordinateSchema,
});

type BoardCellSchema = typeof BoardCellSchema;
export namespace BoardCellSchema {
	export type Type = z.infer<BoardCellSchema>;
}
