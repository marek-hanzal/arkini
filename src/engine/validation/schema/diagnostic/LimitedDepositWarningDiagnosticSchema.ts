import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const LimitedDepositWarningDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("deposit:unsustainable"),
		severity: z.literal("warning"),
		itemId: IdSchema,
	})
	.strict()
	.meta({
		id: "LimitedDepositWarningDiagnosticSchema",
		description: "A finite deposit has no configured output path that recreates it.",
	});

export type LimitedDepositWarningDiagnosticSchema = typeof LimitedDepositWarningDiagnosticSchema;

export namespace LimitedDepositWarningDiagnosticSchema {
	export type Type = z.infer<LimitedDepositWarningDiagnosticSchema>;
}
