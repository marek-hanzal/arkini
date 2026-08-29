import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorBoardScenarioNameSchema } from "~/board-scenario/EditorBoardScenarioSchema";
import { EditorObjectHashSchema } from "./EditorObjectHashSchema";

/** Complete logical snapshot referencing immutable full objects by content hash. */
export const EditorVersionManifestSchema = z
	.object({
		game: EditorObjectHashSchema,
		items: z.record(IdSchema, EditorObjectHashSchema),
		assets: z.record(IdSchema, EditorObjectHashSchema),
		resources: z.record(IdSchema, EditorObjectHashSchema),
		scenarios: z.record(EditorBoardScenarioNameSchema, EditorObjectHashSchema),
	})
	.strict()
	.meta({
		id: "EditorVersionManifestSchema",
		description: "A full version manifest with no deltas or tombstones.",
	});

export type EditorVersionManifestSchema = typeof EditorVersionManifestSchema;

export namespace EditorVersionManifestSchema {
	export type Type = z.infer<EditorVersionManifestSchema>;
}
