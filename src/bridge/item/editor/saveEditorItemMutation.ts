import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { runEditorProjectMutationFx } from "~/bridge/editor/runEditorProjectMutationFx";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { saveEditorItemFx } from "~/bridge/item/editor/saveEditorItemFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace saveEditorItemMutation {
	export interface Variables {
		readonly expectedRevision: string;
		readonly item: EditorItem;
		readonly projectId: string;
	}
}

/** Serializes one validated item upsert against the latest canonical in-memory project. */
export const saveEditorItemMutationFx = Effect.fn("saveEditorItemMutationFx")(
	(variables: saveEditorItemMutation.Variables) =>
		runEditorProjectMutationFx({
			expectedRevision: variables.expectedRevision,
			projectId: variables.projectId,
			run: (expectedRevision) =>
				Effect.gen(function* () {
					const project = yield* Atom.get(EditorProjectAtom(variables.projectId));
					if (project === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "project-not-found",
								message: `Editor project ${variables.projectId} is not loaded.`,
							}),
						);
					}
					return yield* saveEditorItemFx({
						expectedRevision,
						item: variables.item,
						project,
					});
				}),
		}),
);
