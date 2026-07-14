import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const KeepReplaceConflictDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("completion:keep-replace"),
		severity: z.literal("error"),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		maximum: PositiveIntegerSchema,
	})
	.strict()
	.meta({
		id: "KeepReplaceConflictDiagnosticSchema",
		description: "A keep-after-completion line may replace its owner.",
	});

export type KeepReplaceConflictDiagnosticSchema = typeof KeepReplaceConflictDiagnosticSchema;

export namespace KeepReplaceConflictDiagnosticSchema {
	export type Type = z.infer<KeepReplaceConflictDiagnosticSchema>;
}
