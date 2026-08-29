import { z } from "zod";

import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { DiagnosticPathSchema } from "~/game-config/diagnostic/schema/DiagnosticPathSchema";

export const ItemOutputEntrySchema = z
	.object({
		output: OutputSchema,
		path: DiagnosticPathSchema,
	})
	.strict()
	.meta({
		id: "ItemOutputEntrySchema",
		description: "One configured output together with its completed-config authoring path.",
	});

export type ItemOutputEntrySchema = typeof ItemOutputEntrySchema;

export namespace ItemOutputEntrySchema {
	export type Type = z.infer<ItemOutputEntrySchema>;
}
