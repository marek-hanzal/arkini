import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { runEditorProjectMutationFx } from "~/bridge/editor/runEditorProjectMutationFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace runLoadedEditorProjectMutationFx {
	export interface Props<MutationResult extends runEditorProjectMutationFx.Result> {
		readonly expectedRevision: string;
		readonly projectId: string;
		readonly run: (
			expectedRevision: string,
			project: EditorProject,
		) => Effect.Effect<MutationResult, unknown, AtomRegistry.AtomRegistry>;
	}
}

/** Runs a canonical write against the latest loaded project in its serialized lane. */
export const runLoadedEditorProjectMutationFx = Effect.fn("runLoadedEditorProjectMutationFx")(
	<MutationResult extends runEditorProjectMutationFx.Result>({
		expectedRevision,
		projectId,
		run,
	}: runLoadedEditorProjectMutationFx.Props<MutationResult>) =>
		runEditorProjectMutationFx({
			expectedRevision,
			projectId,
			run: (revision) =>
				Effect.gen(function* () {
					const project = yield* Atom.get(EditorProjectAtom(projectId));
					if (project === undefined) {
						return yield* Effect.fail(
							new EditorProjectError({
								reason: "project-not-found",
								message: `Editor project ${projectId} is not loaded.`,
							}),
						);
					}
					return yield* run(revision, project);
				}),
		}),
);
