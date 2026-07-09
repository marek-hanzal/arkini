import { z } from "zod";
import { IdSchema } from "~/config/IdSchema";
import { ActivationEffectViewSchema } from "~/board/view/ActivationEffectViewSchema";

export const ActivationDropViewSchema = z.object({
	itemId: IdSchema,
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
