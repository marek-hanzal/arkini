import { z } from "zod";

import { TranslationSchema } from "~/translation/schema/TranslationSchema";

export const TranslationListSchema = z.record(z.string().min(1), TranslationSchema).meta({
	id: "TranslationList",
	description: "Authoring map of plain translation keys to their values.",
});

export type TranslationListSchema = typeof TranslationListSchema;

export namespace TranslationListSchema {
	export type Type = z.infer<TranslationListSchema>;
}
