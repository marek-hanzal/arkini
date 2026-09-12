import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const StochasticUnitRenewalWarningDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"UnitRenewalStochastic",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Warning",
		]),
		itemId: IdSchema,
	})
	.strict()
	.meta({
		id: "StochasticUnitRenewalWarningDiagnosticSchema",
		description:
			"A item with units is recreated only through probabilistic, weighted, or conditional output paths.",
	});

export type StochasticUnitRenewalWarningDiagnosticSchema =
	typeof StochasticUnitRenewalWarningDiagnosticSchema;

export namespace StochasticUnitRenewalWarningDiagnosticSchema {
	export type Type = z.infer<StochasticUnitRenewalWarningDiagnosticSchema>;
}
