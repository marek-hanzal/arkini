import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const StochasticLimitedDepositWarningDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract(["DepositStochasticSoftlock"]),
		severity: DiagnosticSeverityEnumSchema.extract(["Warning"]),
		itemId: IdSchema,
	})
	.strict()
	.meta({
		id: "StochasticLimitedDepositWarningDiagnosticSchema",
		description:
			"A finite deposit is recreated only through probabilistic, weighted, or conditional output paths.",
	});

export type StochasticLimitedDepositWarningDiagnosticSchema =
	typeof StochasticLimitedDepositWarningDiagnosticSchema;

export namespace StochasticLimitedDepositWarningDiagnosticSchema {
	export type Type = z.infer<StochasticLimitedDepositWarningDiagnosticSchema>;
}
