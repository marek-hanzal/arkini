import { Effect } from "effect";

import { runLoadedEditorProjectMutationFx } from "~/bridge/editor/runLoadedEditorProjectMutationFx";
import { saveEditorAssetFx } from "~/bridge/resource/editor/saveEditorAssetFx";

export namespace saveEditorAssetMutation {
	export interface Variables {
		readonly expectedRevision: string;
		readonly file: File;
		readonly projectId: string;
	}
}

export const saveEditorAssetMutationFx = Effect.fn("saveEditorAssetMutationFx")(
	(variables: saveEditorAssetMutation.Variables) =>
		runLoadedEditorProjectMutationFx({
			expectedRevision: variables.expectedRevision,
			projectId: variables.projectId,
			run: (expectedRevision, project) =>
				saveEditorAssetFx({
					expectedRevision,
					file: variables.file,
					project,
				}),
		}),
);
