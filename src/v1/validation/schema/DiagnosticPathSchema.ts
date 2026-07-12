import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";

export const DiagnosticPathSchema = z
	.array(
		z.union([
			z.string(),
			NonNegativeIntegerSchema,
		]),
	)
	.meta({
		id: "DiagnosticPathSchema",
		description: "The authoring path associated with one game diagnostic.",
	});

export type DiagnosticPathSchema = typeof DiagnosticPathSchema;

export namespace DiagnosticPathSchema {
	export type Type = z.infer<DiagnosticPathSchema>;
}
