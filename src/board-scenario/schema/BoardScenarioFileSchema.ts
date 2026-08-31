import { z } from "zod";

import { BoardScenarioNameSchema } from "~/board-scenario/schema/BoardScenarioSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

/** Portable authored Board scenario with its opaque save bytes encoded as JSON. */
export const BoardScenarioFileSchema = z
	.object({
		name: BoardScenarioNameSchema,
		revision: z.number().int().nonnegative(),
		version: GameVersionSchema,
		save: z.base64().min(1),
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
		id: "EditorBoardScenarioFileSchema",
		description: "One hashed scenarios/<sha256>.json file in a portable Editor project.",
	});

export type BoardScenarioFileSchema = typeof BoardScenarioFileSchema;

export namespace BoardScenarioFileSchema {
	export type Type = z.infer<BoardScenarioFileSchema>;
}
