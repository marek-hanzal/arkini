import { Effect } from "effect";

import type { EditorProjectRepositoryService } from "~/project-authoring/service/EditorProjectRepository";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemSchema as CanonicalItemSchema } from "~/item-definition/schema/ItemSchema";

/** Validates and persists one item through the canonical editor repository. */
export const saveEditorItemWithRepositoryFx = Effect.fn("saveEditorItemWithRepositoryFx")(
	function* ({
		expectedRevision,
		item: candidate,
		projectId,
		repository,
	}: {
		readonly expectedRevision?: number;
		readonly item: Pick<ItemSchema.Type, "id" | "type"> & Record<string, unknown>;
		readonly projectId: string;
		readonly repository: EditorProjectRepositoryService;
	}) {
		const item = yield* Effect.try({
			try: () => CanonicalItemSchema.parse(candidate),
			catch: (cause) =>
				new EditorProjectError({
					reason: "invalid-item",
					message: `Item ${candidate.id} does not satisfy its ${candidate.type} schema.`,
					cause,
				}),
		});
		const commit = yield* repository.upsertItemFx({
			expectedRevision,
			projectId,
			item,
		});
		return {
			commit,
			item,
		} as const;
	},
);
