import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticProviderEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticProviderEnumSchema";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateProviderDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"SourceDuplicateProvider",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		provider: DiagnosticProviderEnumSchema,
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
