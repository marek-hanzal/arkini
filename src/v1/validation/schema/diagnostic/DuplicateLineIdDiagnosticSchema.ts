import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { DiagnosticPathSchema } from "../DiagnosticPathSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const DuplicateLineIdDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("line:duplicate-id"),
		severity: z.literal("error"),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		paths: z.tuple([
			DiagnosticPathSchema,
			DiagnosticPathSchema,
		]),
	})
	.strict()
	.meta({
		id: "DuplicateLineIdDiagnosticSchema",
		description: "Two product lines owned by one item use the same stable line ID.",
	});

export type DuplicateLineIdDiagnosticSchema = typeof DuplicateLineIdDiagnosticSchema;
export namespace DuplicateLineIdDiagnosticSchema {
	export type Type = z.infer<DuplicateLineIdDiagnosticSchema>;
}
