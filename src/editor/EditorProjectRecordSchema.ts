import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Canonical project row persisted without duplicated display metadata. */
export const EditorProjectRecordSchema = z
	.object({
		projectId: IdSchema,
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
		description: "One canonical persisted editor project row.",
	});

export type EditorProjectRecordSchema = typeof EditorProjectRecordSchema;

export namespace EditorProjectRecordSchema {
	export type Type = z.infer<EditorProjectRecordSchema>;
}
