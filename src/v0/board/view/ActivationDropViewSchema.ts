import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const ActivationDropViewSchema = z.object({
	itemId: GameItemIdSchema,
	quantityLabel: z.string(),
	chanceLabel: z.string(),
	rollLabel: z.string().optional(),
});

type ActivationDropViewSchema = typeof ActivationDropViewSchema;
export namespace ActivationDropViewSchema {
	export type Type = z.infer<ActivationDropViewSchema>;
}

export type ActivationDropView = ActivationDropViewSchema.Type;
