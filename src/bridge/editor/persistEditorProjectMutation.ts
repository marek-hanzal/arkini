import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { runLoadedEditorProjectMutationFx } from "~/bridge/editor/runLoadedEditorProjectMutationFx";
import { saveEditorItemFx } from "~/bridge/item/editor/saveEditorItemFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

const persistEditorItemFx = Effect.fn("persistStagedEditorItemFx")(function* ({
	expectedRevision,
	item,
	projectId,
}: {
	readonly expectedRevision: string;
	readonly item: EditorProjectDraftAtom.State[string];
	readonly projectId: string;
}) {
	return yield* runLoadedEditorProjectMutationFx({
		expectedRevision,
		projectId,
		run: (revision, project) =>
			saveEditorItemFx({
				expectedRevision: revision,
				item,
				project,
			}).pipe(
				Effect.tap(() =>
					Atom.set(EditorProjectDraftAtom(projectId), {
						action: "remove",
						item,
					}),
				),
			),
	});
});

/** Persists the current staged snapshot in FIFO order and retains any uncommitted tail. */
export const persistEditorProjectMutationFx = Effect.fn("persistEditorProjectMutationFx")(
	function* (projectId: string) {
		const project = yield* Atom.get(EditorProjectAtom(projectId));
		if (project === undefined) {
			return yield* Effect.fail(
				new EditorProjectError({
					reason: "project-not-found",
					message: `Editor project ${projectId} is not loaded.`,
				}),
			);
		}
		const staged = yield* Atom.get(EditorProjectDraftAtom(projectId));
		let revision = project.revision;
		for (const item of Object.values(staged)) {
			const result = yield* persistEditorItemFx({
				expectedRevision: revision,
				item,
				projectId,
			});
			revision = result.revision;
		}
		return yield* Atom.get(EditorProjectAtom(projectId));
	},
);
