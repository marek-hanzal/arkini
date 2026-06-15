import { z } from "zod";

export const GameResourceIdSchema = z
	.string()
	.startsWith("resource:") as z.ZodType<`resource:${string}`>;

type GameResourceIdSchema = typeof GameResourceIdSchema;
export namespace GameResourceIdSchema {
	export type Type = z.infer<GameResourceIdSchema>;
}
