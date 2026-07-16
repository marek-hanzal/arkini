import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

/** One material selector accepts a canonical item that cannot enter input storage. */
export const IneligibleMaterialInputDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("input:material-ineligible"),
		severity: z.literal("error"),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
		candidateItemId: IdSchema,
	})
	.strict()
	.meta({
		id: "IneligibleMaterialInputDiagnosticSchema",
		description:
			"A material input selector accepts a canonical item that cannot enter material-input storage.",
	});

export type IneligibleMaterialInputDiagnosticSchema =
	typeof IneligibleMaterialInputDiagnosticSchema;

export namespace IneligibleMaterialInputDiagnosticSchema {
	export type Type = z.infer<IneligibleMaterialInputDiagnosticSchema>;
}
