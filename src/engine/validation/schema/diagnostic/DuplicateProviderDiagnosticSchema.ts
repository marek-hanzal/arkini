import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { DiagnosticProviderEnumSchema } from "~/engine/validation/schema/DiagnosticProviderEnumSchema";

import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateProviderDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			DiagnosticCodeEnumSchema.enum.SourceDuplicateProvider,
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			DiagnosticSeverityEnumSchema.enum.Error,
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
