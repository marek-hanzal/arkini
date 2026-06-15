import { z } from "zod";

export const BoardItemIdSchema = z.string().min(1);

type BoardItemIdSchema = typeof BoardItemIdSchema;
export namespace BoardItemIdSchema {
	export type Type = z.infer<BoardItemIdSchema>;
}
