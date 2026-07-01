import { z } from "zod";
import { GameItemIdSchema } from "~/v0/game/config/GameIdSchema";

export const ActivationDropEffectViewSchema = z
	.object({
		active: z.boolean(),
		impact: z.enum([
			"availability",
			"chance",
			"visibility",
		]),
		kind: z.string().min(1),
		label: z.string().min(1),
		ready: z.boolean(),
		result: z.string().min(1),
	})
	.strict();

export const ActivationDropViewSchema = z.object({
	itemId: GameItemIdSchema,
	quantityLabel: z.string(),
	chanceLabel: z.string(),
	enabled: z.boolean().optional(),
	effects: z.array(ActivationDropEffectViewSchema).optional(),
	rollLabel: z.string().optional(),
});

type ActivationDropViewSchema = typeof ActivationDropViewSchema;
export namespace ActivationDropViewSchema {
	export type Type = z.infer<ActivationDropViewSchema>;
}

export type ActivationDropView = ActivationDropViewSchema.Type;
