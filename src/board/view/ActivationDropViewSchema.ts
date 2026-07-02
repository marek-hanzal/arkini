import { z } from "zod";
import { GameItemIdSchema } from "~/config/GameIdSchema";
import { ActivationEffectViewSchema } from "~/board/view/ActivationEffectViewSchema";

export const ActivationDropViewSchema = z.object({
	itemId: GameItemIdSchema,
	quantityLabel: z.string(),
	chanceLabel: z.string(),
	enabled: z.boolean().optional(),
	effects: z.array(ActivationEffectViewSchema).optional(),
	rollLabel: z.string().optional(),
});

type ActivationDropViewSchema = typeof ActivationDropViewSchema;
export namespace ActivationDropViewSchema {
	export type Type = z.infer<ActivationDropViewSchema>;
}

export type ActivationDropView = ActivationDropViewSchema.Type;
