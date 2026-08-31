import { z } from "zod";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { BoardScenarioNameSchema } from "~/board-scenario/schema/BoardScenarioSchema";
import { VersionObjectHashSchema } from "./VersionObjectHashSchema";

/** Complete logical snapshot referencing immutable full objects by content hash. */
export const VersionManifestSchema = z
	.object({
		game: VersionObjectHashSchema,
		items: z.record(IdSchema, VersionObjectHashSchema),
		assets: z.record(IdSchema, VersionObjectHashSchema),
		resources: z.record(IdSchema, VersionObjectHashSchema),
		scenarios: z.record(BoardScenarioNameSchema, VersionObjectHashSchema),
	})
	.strict()
	.meta({
		id: "EditorVersionManifestSchema",
		description: "A full version manifest with no deltas or tombstones.",
	});

export type VersionManifestSchema = typeof VersionManifestSchema;

export namespace VersionManifestSchema {
	export type Type = z.infer<VersionManifestSchema>;
}
