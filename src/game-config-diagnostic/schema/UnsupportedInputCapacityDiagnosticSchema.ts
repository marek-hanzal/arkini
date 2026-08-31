import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const UnsupportedInputCapacityDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract([
			"InputCapacityUnsupported",
		]),
		severity: DiagnosticSeverityEnumSchema.extract([
			"Error",
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
