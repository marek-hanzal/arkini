import { Effect } from "effect";

import { runEditorProjectMutationFx } from "~/bridge/editor/EditorProjectMutationLane";
import { saveEditorAssetFx } from "~/bridge/editor/saveEditorAssetFx";

export namespace saveEditorAssetMutation {
	export interface Variables {
		readonly expectedRevision: string;
		readonly file: File;
		readonly projectId: string;
	}
}

export const saveEditorAssetMutationFx = Effect.fn("saveEditorAssetMutationFx")(
	(variables: saveEditorAssetMutation.Variables) =>
		runEditorProjectMutationFx({
			expectedRevision: variables.expectedRevision,
			projectId: variables.projectId,
			run: (expectedRevision) =>
				saveEditorAssetFx({
					expectedRevision,
					file: variables.file,
					projectId: variables.projectId,
				}),
		}),
);
