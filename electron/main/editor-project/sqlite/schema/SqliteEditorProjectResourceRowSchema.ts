import { z } from "zod";

import { EditorProjectResourceRecordSchema } from "~/editor/EditorProjectResourceRecordSchema";

/** Decodes one physical SQLite resource row and detaches its mutable BLOB bytes. */
export const SqliteEditorProjectResourceRowSchema = z
	.object({
		project_id: z.string(),
		id: z.string(),
		mime: z.string(),
		bytes: z.instanceof(Uint8Array),
	})
	.strict()
	.transform((row, context) => {
		const result = EditorProjectResourceRecordSchema.safeParse({
			projectId: row.project_id,
			id: row.id,
			mime: row.mime,
			bytes: Uint8Array.from(row.bytes),
		});
		if (result.success) return result.data;
		for (const issue of result.error.issues)
			context.addIssue({
				code: "custom",
				message: issue.message,
				path: issue.path,
			});
		return z.NEVER;
	})
	.meta({
		id: "SqliteEditorProjectResourceRowSchema",
		description: "One physical SQLite row decoded into a canonical editor resource record.",
	});

export type SqliteEditorProjectResourceRowSchema = typeof SqliteEditorProjectResourceRowSchema;

export namespace SqliteEditorProjectResourceRowSchema {
	export type Type = z.infer<SqliteEditorProjectResourceRowSchema>;
}
