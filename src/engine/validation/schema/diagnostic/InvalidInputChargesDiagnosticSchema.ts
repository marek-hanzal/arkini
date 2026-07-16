import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

/** One authored input charge contract cannot resolve a valid payer. */
export const InvalidInputChargesDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("input:charges-invalid"),
		severity: z.literal("error"),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
		reason: z.enum([
			"deposit-missing-target-cost",
			"deposit-must-target",
			"target-requires-deposit",
			"self-missing-charges",
			"self-insufficient-charges",
			"target-unavailable",
			"target-insufficient-total-charges",
		]),
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
