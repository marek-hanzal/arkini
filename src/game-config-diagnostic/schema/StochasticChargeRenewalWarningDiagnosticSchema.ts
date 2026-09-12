import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const StochasticChargeRenewalWarningDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"ChargeRenewalStochastic",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Warning",
		]),
		itemId: IdSchema,
	})
	.strict()
	.meta({
		id: "StochasticChargeRenewalWarningDiagnosticSchema",
		description:
			"A charged item is recreated only through probabilistic, weighted, or conditional output paths.",
	});

export type StochasticChargeRenewalWarningDiagnosticSchema =
	typeof StochasticChargeRenewalWarningDiagnosticSchema;

export namespace StochasticChargeRenewalWarningDiagnosticSchema {
	export type Type = z.infer<StochasticChargeRenewalWarningDiagnosticSchema>;
}
