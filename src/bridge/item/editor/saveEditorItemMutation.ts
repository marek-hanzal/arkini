import { Effect } from "effect";

import { runLoadedEditorProjectMutationFx } from "~/bridge/editor/runLoadedEditorProjectMutationFx";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { saveEditorItemFx } from "~/bridge/item/editor/saveEditorItemFx";

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
		runLoadedEditorProjectMutationFx({
			expectedRevision: variables.expectedRevision,
			projectId: variables.projectId,
			run: (expectedRevision, project) =>
				saveEditorItemFx({
					expectedRevision,
					item: variables.item,
					project,
				}),
		}),
);
