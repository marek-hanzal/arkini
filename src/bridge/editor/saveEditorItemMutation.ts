import { Effect } from "effect";

import type { EditorItem } from "~/bridge/editor/EditorItemModel";
import { runEditorProjectMutationFx } from "~/bridge/editor/EditorProjectMutationLane";
import { saveEditorItemFx } from "~/bridge/editor/saveEditorItemFx";

export namespace saveEditorItemMutation {
	export interface Variables {
		readonly expectedRevision: string;
		readonly item: EditorItem;
		readonly projectId: string;
	}
}

/** Serializes one validated item upsert through the project mutation lane. */
export const saveEditorItemMutationFx = Effect.fn("saveEditorItemMutationFx")(
	(variables: saveEditorItemMutation.Variables) =>
		runEditorProjectMutationFx({
			expectedRevision: variables.expectedRevision,
			projectId: variables.projectId,
			run: (expectedRevision) =>
				saveEditorItemFx({
					expectedRevision,
					item: variables.item,
					projectId: variables.projectId,
				}),
		}),
);
