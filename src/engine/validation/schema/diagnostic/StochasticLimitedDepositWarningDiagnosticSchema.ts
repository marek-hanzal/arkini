import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const StochasticLimitedDepositWarningDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("deposit:stochastic-softlock"),
		severity: z.literal("warning"),
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
