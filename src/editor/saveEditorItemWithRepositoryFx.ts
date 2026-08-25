import { Effect } from "effect";

import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemSchema as CanonicalItemSchema } from "~/engine/item/schema/ItemSchema";

/** Validates and persists one item through the canonical editor repository. */
export const saveEditorItemWithRepositoryFx = Effect.fn("saveEditorItemWithRepositoryFx")(
	function* ({
		item: candidate,
		projectId,
		repository,
	}: {
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
			projectId,
			item,
		});
		return {
			commit,
			item,
		} as const;
	},
);
