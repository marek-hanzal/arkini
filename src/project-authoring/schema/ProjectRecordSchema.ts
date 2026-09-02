import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

/** Canonical project row persisted without duplicated display metadata. */
export const ProjectRecordSchema = z
	.object({
		projectId: IdSchema,
		config: GameConfigSchema,
		version: GameVersionSchema,
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

export type ProjectRecordSchema = typeof ProjectRecordSchema;

export namespace ProjectRecordSchema {
	export type Type = z.infer<ProjectRecordSchema>;
}
