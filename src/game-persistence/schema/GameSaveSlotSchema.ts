import { z } from "zod";

export const GameSaveSlotSchema = z.enum([
	"current",
	"manual",
	"5-min",
	"30-min",
	"4-hour",
]);
export type GameSaveSlotSchema = typeof GameSaveSlotSchema;
export namespace GameSaveSlotSchema {
	export type Type = z.infer<GameSaveSlotSchema>;
}
