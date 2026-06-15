import { z } from "zod";

export const GameSaveViewSchema = z.object({
	id: z.string().min(1),
	boardWidth: z.number().int().positive(),
	boardHeight: z.number().int().positive(),
	inventorySlots: z.number().int().nonnegative(),
});

type GameSaveViewSchema = typeof GameSaveViewSchema;
export namespace GameSaveViewSchema {
	export type Type = z.infer<GameSaveViewSchema>;
}

export type GameSaveView = GameSaveViewSchema.Type;
