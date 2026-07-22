import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const UnsupportedInputCapacityDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			DiagnosticCodeEnumSchema.enum.InputCapacityUnsupported,
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			DiagnosticSeverityEnumSchema.enum.Error,
		]),
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
