import { z } from "zod";

import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TagSchema } from "~/engine/tag/schema/TagSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const EmptyMaterialTagDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: DiagnosticCodeEnumSchema.extract(["InputMaterialTagEmpty"]),
		severity: DiagnosticSeverityEnumSchema.extract(["Error"]),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		inputIndex: z.number().int().nonnegative(),
		tag: TagSchema,
	})
	.strict()
	.meta({
		id: "EmptyMaterialTagDiagnosticSchema",
		description: "A material input tag selector matches no canonical item.",
	});

export type EmptyMaterialTagDiagnosticSchema = typeof EmptyMaterialTagDiagnosticSchema;
export namespace EmptyMaterialTagDiagnosticSchema {
	export type Type = z.infer<EmptyMaterialTagDiagnosticSchema>;
}
