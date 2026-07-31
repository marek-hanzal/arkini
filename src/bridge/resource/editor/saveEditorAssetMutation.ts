import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { runEditorProjectMutationFx } from "~/bridge/editor/runEditorProjectMutationFx";
import { saveEditorAssetFx } from "~/bridge/resource/editor/saveEditorAssetFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

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
					return yield* saveEditorAssetFx({
						expectedRevision,
						file: variables.file,
						project,
					});
				}),
		}),
);
