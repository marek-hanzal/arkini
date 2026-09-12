import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";
import { InvalidInputUnitsReasonEnumSchema } from "~/game-config-diagnostic/schema/InvalidInputUnitsReasonEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

/** One authored input unit contract cannot resolve a valid payer. */
export const InvalidInputUnitsDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"InputUnitsInvalid",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
		]),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
		reason: InvalidInputUnitsReasonEnumSchema,
	})
	.strict()
	.meta({
		id: "InvalidInputUnitsDiagnosticSchema",
		description: "An authored input unit cost cannot resolve a valid runtime payer.",
	});

export type InvalidInputUnitsDiagnosticSchema = typeof InvalidInputUnitsDiagnosticSchema;

export namespace InvalidInputUnitsDiagnosticSchema {
	export type Type = z.infer<InvalidInputUnitsDiagnosticSchema>;
}
