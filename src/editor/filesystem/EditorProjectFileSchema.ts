import { z } from "zod";

import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";

/** Root marker required before a directory can be opened as an Editor project. */
export const EditorProjectFileSchema = z
	.object({
		arkini: z.literal(ArkiniAppVersion),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorProjectFileSchema",
		description: "The minimal root marker for one portable Editor project directory.",
	});

export type EditorProjectFileSchema = typeof EditorProjectFileSchema;

export namespace EditorProjectFileSchema {
	export type Type = z.infer<EditorProjectFileSchema>;
}
