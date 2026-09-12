import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const MissingChargeRenewalWarningDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ChargeRenewalMissing",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Warning",
		]),
		itemId: IdSchema,
	})
	.strict()
	.meta({
		id: "MissingChargeRenewalWarningDiagnosticSchema",
		description: "A charged item has no configured output path that recreates it.",
	});

export type MissingChargeRenewalWarningDiagnosticSchema =
	typeof MissingChargeRenewalWarningDiagnosticSchema;

export namespace MissingChargeRenewalWarningDiagnosticSchema {
	export type Type = z.infer<MissingChargeRenewalWarningDiagnosticSchema>;
}
