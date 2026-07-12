import { z } from "zod";

import { OutputSchema } from "~/v1/output/schema/OutputSchema";
import { DiagnosticPathSchema } from "./DiagnosticPathSchema";

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
