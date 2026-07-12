import { z } from "zod";

import { LineSchema } from "~/v1/line/schema/LineSchema";
import { DiagnosticPathSchema } from "./DiagnosticPathSchema";

export const ItemLineEntrySchema = z
	.object({
		line: LineSchema,
		path: DiagnosticPathSchema,
	})
	.strict()
	.meta({
		id: "ItemLineEntrySchema",
		description: "One product line together with its completed-config authoring path.",
	});

export type ItemLineEntrySchema = typeof ItemLineEntrySchema;

export namespace ItemLineEntrySchema {
	export type Type = z.infer<ItemLineEntrySchema>;
}
