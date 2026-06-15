import { z } from "zod";

export const BoardCoordinateSchema = z.number().int().min(0);

type BoardCoordinateSchema = typeof BoardCoordinateSchema;
export namespace BoardCoordinateSchema {
	export type Type = z.infer<BoardCoordinateSchema>;
}
