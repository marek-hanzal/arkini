import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";
import { InvalidInputChargesReasonEnumSchema } from "~/engine/validation/schema/InvalidInputChargesReasonEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

/** One authored input charge contract cannot resolve a valid payer. */
export const InvalidInputChargesDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract(["InputChargesInvalid"]),
		severity: DiagnosticSeverityEnumSchema.extract(["Error"]),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
		reason: InvalidInputChargesReasonEnumSchema,
	})
	.strict()
	.meta({
		id: "InvalidInputChargesDiagnosticSchema",
		description: "An authored input charge cost cannot resolve a valid runtime payer.",
	});

export type InvalidInputChargesDiagnosticSchema = typeof InvalidInputChargesDiagnosticSchema;

export namespace InvalidInputChargesDiagnosticSchema {
	export type Type = z.infer<InvalidInputChargesDiagnosticSchema>;
}
