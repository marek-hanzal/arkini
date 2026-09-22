import { z } from "zod";

import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { DiagnosticPathSchema } from "~/game-config-diagnostic/schema/DiagnosticPathSchema";

export const ItemOutcomeEntrySchema = z
	.object({
		outcome: OutcomeTableSchema,
		path: DiagnosticPathSchema,
	})
	.strict()
	.meta({
		id: "ItemOutcomeEntrySchema",
		description: "One configured outcome together with its completed-config authoring path.",
	});

export type ItemOutcomeEntrySchema = typeof ItemOutcomeEntrySchema;

export namespace ItemOutcomeEntrySchema {
	export type Type = z.infer<ItemOutcomeEntrySchema>;
}
