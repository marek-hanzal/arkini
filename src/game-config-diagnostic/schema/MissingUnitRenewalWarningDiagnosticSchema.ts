import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MissingUnitRenewalWarningDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"UnitRenewalMissing",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Warning",
		]),
		itemId: IdSchema,
	})
	.strict()
	.meta({
		id: "MissingUnitRenewalWarningDiagnosticSchema",
		description: "A item with units has no configured output path that recreates it.",
	});

export type MissingUnitRenewalWarningDiagnosticSchema =
	typeof MissingUnitRenewalWarningDiagnosticSchema;

export namespace MissingUnitRenewalWarningDiagnosticSchema {
	export type Type = z.infer<MissingUnitRenewalWarningDiagnosticSchema>;
}
