import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const ActivationDepletionSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("remove"),
	}),
	z.object({
		kind: z.literal("replace"),
		itemId: GameItemIdSchema,
	}),
]);

type ActivationDepletionSchema = typeof ActivationDepletionSchema;
export namespace ActivationDepletionSchema {
	export type Type = z.infer<ActivationDepletionSchema>;
}
