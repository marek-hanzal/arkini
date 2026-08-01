import { z } from "zod";

import { EditorProjectIdSchema } from "~/engine/editor/schema/EditorProjectIdSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Canonical project row persisted in IndexedDB without duplicated display metadata. */
export const EditorProjectRecordSchema = z
	.object({
		projectId: EditorProjectIdSchema,
		config: GameConfigSchema,
		revision: z.number().int().nonnegative(),
		createdAtMs: z.number().int().nonnegative(),
		updatedAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.refine(({ createdAtMs, updatedAtMs }) => updatedAtMs >= createdAtMs, {
		message: "updatedAtMs must not precede createdAtMs.",
		path: [
			"updatedAtMs",
		],
	})
	.meta({
		id: "EditorProjectRecordSchema",
		description: "One canonical editor project row persisted in IndexedDB.",
	});

export type EditorProjectRecordSchema = typeof EditorProjectRecordSchema;

export namespace EditorProjectRecordSchema {
	export type Type = z.infer<EditorProjectRecordSchema>;
}
