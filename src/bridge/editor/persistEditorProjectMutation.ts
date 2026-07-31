import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import {
	EditorProjectDraftAtom,
	type StagedEditorItem,
} from "~/bridge/editor/EditorProjectDraftAtom";
import { runEditorProjectMutationFx } from "~/bridge/editor/EditorProjectMutationLane";
import { saveEditorItemFx } from "~/bridge/editor/saveEditorItemFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

const persistChangeFx = Effect.fn("persistEditorProjectChangeFx")(function* ({
	change,
	expectedRevision,
	key,
	projectId,
}: {
	readonly change: StagedEditorItem;
	readonly expectedRevision: string;
	readonly key: string;
	readonly projectId: string;
}) {
	return yield* runEditorProjectMutationFx({
		expectedRevision,
		projectId,
		run: (revision) =>
			saveEditorItemFx({
				expectedRevision: revision,
				item: change.item,
				projectId,
				sourceItemId: change.sourceItemId,
				sourcePath: change.sourcePath,
			}).pipe(
				Effect.tap(() =>
					Effect.gen(function* () {
						yield* Atom.set(EditorProjectDraftAtom(projectId), {
							action: "remove",
							change,
							key,
						});
					}),
				),
			),
	});
});

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
		for (const [key, change] of Object.entries(staged)) {
			const result = yield* persistChangeFx({
				change,
				expectedRevision: revision,
				key,
				projectId,
			});
			revision = result.revision;
		}
		return yield* Atom.get(EditorProjectAtom(projectId));
	},
);
