import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TagSchema } from "~/v1/tag/schema/TagSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const EmptyMaterialTagDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("input:material-tag-empty"),
		severity: z.literal("error"),
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
