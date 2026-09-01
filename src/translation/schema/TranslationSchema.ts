import { z } from "zod";

export const TranslationSchema = z
	.object({
		value: z.string(),
		dynamic: z.boolean().optional(),
	})
	.strict()
	.meta({
		id: "Translation",
		description: "One authored translation entry.",
	});

export type TranslationSchema = typeof TranslationSchema;

export namespace TranslationSchema {
	export type Type = z.infer<TranslationSchema>;
}
