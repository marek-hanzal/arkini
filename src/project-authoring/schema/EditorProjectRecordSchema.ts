import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Canonical project row persisted without duplicated display metadata. */
export const EditorProjectRecordSchema = z
	.object({
		projectId: IdSchema,
		config: GameConfigSchema,
		version: ArkpackVersionSchema,
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
