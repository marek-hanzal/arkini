import { z } from "zod";

export const TranslationSchema = z
	.object({
		key: z.string().min(1),
		value: z.string(),
		dynamic: z.boolean().optional(),
	})
	.strict()
	.meta({
		id: "Translation",
		description: "One runtime translation entry.",
	});

export type TranslationSchema = typeof TranslationSchema;

export namespace TranslationSchema {
	export type Type = z.infer<TranslationSchema>;
}
