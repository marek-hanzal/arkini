import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const UnsupportedInputCapacityDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("input:capacity-unsupported"),
		severity: z.literal("error"),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
		capacity: PositiveIntegerSchema,
	})
	.strict()
	.meta({
		id: "UnsupportedInputCapacityDiagnosticSchema",
		description: "A non-producer line authors material buffering capacity.",
	});

export type UnsupportedInputCapacityDiagnosticSchema =
	typeof UnsupportedInputCapacityDiagnosticSchema;

export namespace UnsupportedInputCapacityDiagnosticSchema {
	export type Type = z.infer<UnsupportedInputCapacityDiagnosticSchema>;
}
