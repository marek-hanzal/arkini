import { z } from "zod";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateProviderDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("source:duplicate-provider"),
		severity: z.literal("error"),
		provider: z.enum([
			"meta",
			"start",
			"version",
		]),
		sources: z.tuple([
			z.string().min(1),
			z.string().min(1),
		]),
	})
	.strict()
	.meta({
		id: "DuplicateProviderDiagnosticSchema",
		description: "Two source fragments provide the same singleton game field.",
	});

export type DuplicateProviderDiagnosticSchema = typeof DuplicateProviderDiagnosticSchema;

export namespace DuplicateProviderDiagnosticSchema {
	export type Type = z.infer<DuplicateProviderDiagnosticSchema>;
}
