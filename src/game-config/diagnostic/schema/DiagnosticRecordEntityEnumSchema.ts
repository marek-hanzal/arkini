import { z } from "zod";

/** The canonical record domain referenced by one completed-game diagnostic. */
export const DiagnosticRecordEntityEnumSchema = z
	.enum({
		Item: "item",
	})
	.meta({
		id: "DiagnosticRecordEntityEnumSchema",
		description: "The canonical record domain referenced by one completed-game diagnostic.",
	});

export type DiagnosticRecordEntityEnumSchema = typeof DiagnosticRecordEntityEnumSchema;

export namespace DiagnosticRecordEntityEnumSchema {
	export type Type = z.infer<DiagnosticRecordEntityEnumSchema>;
}
