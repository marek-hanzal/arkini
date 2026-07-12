import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { BaseDiagnosticSchema } from "./BaseDiagnosticSchema";

export const KeyIdMismatchDiagnosticSchema = z
	.object({
		...BaseDiagnosticSchema.shape,
		code: z.literal("config:key-id-mismatch"),
		severity: z.literal("error"),
		entity: z.enum([
			"item",
			"category",
		]),
		key: IdSchema,
		id: IdSchema,
	})
	.strict()
	.meta({
		id: "KeyIdMismatchDiagnosticSchema",
		description: "A canonical record key differs from its embedded immutable ID.",
	});

export type KeyIdMismatchDiagnosticSchema = typeof KeyIdMismatchDiagnosticSchema;

export namespace KeyIdMismatchDiagnosticSchema {
	export type Type = z.infer<KeyIdMismatchDiagnosticSchema>;
}
