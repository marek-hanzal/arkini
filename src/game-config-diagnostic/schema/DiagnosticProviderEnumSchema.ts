import { z } from "zod";

/** The singleton completed-game field provided by one source fragment. */
export const DiagnosticProviderEnumSchema = z
	.enum({
		Meta: "meta",
		Music: "music",
		Sfx: "sfx",
		Resources: "resources",
		Start: "start",
	})
	.meta({
		id: "DiagnosticProviderEnumSchema",
		description: "The singleton completed-game field provided by one source fragment.",
	});

export type DiagnosticProviderEnumSchema = typeof DiagnosticProviderEnumSchema;

export namespace DiagnosticProviderEnumSchema {
	export type Type = z.infer<DiagnosticProviderEnumSchema>;
}
