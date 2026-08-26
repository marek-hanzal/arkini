import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProjectTransport } from "../../../electron/contract/editor/EditorProjectTransport";
import { EditorProjectPayloadSchema } from "~/bridge/editor/EditorProjectPayloadSchema";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/bridge/editor/EditorProjectRepositoryError";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/bridge/editor/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/bridge/editor/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/bridge/editor/EditorProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/bridge/editor/board/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";
import { invokeEditorProjectTransportFx } from "~/bridge/editor/invokeEditorProjectTransportFx";
import { publishEditorProjectFx } from "~/bridge/editor/publishEditorProjectFx";

export namespace refreshEditorProjectFx {
	export interface Props {
		readonly projectId: string;
	}
}

const requestRefreshFx = (projectId: string) =>
	invokeEditorProjectTransportFx({
		call: () => window.arkini.editor.refreshProject(projectId),
		operation: "refresh-project",
		parse: (candidate: EditorProjectTransport.Project) => {
			const project = EditorProjectPayloadSchema.parse(candidate);
			if (project.projectId !== projectId)
				throw new Error("Editor refresh response identity does not match the request.");
			return project;
		},
		requestMessage: "The editor project refresh request failed.",
		responseMessage: "The editor project refresh response is invalid.",
	});

/** Hard-replaces the mounted project with its authoritative Editor-folder state. */
export const refreshEditorProjectFx = Effect.fn("refreshEditorProjectFx")(
	({ projectId }: refreshEditorProjectFx.Props) =>
		Effect.acquireUseRelease(
			Effect.try({
				try: blockEditorProjectWrites,
				catch: (cause) =>
					cause instanceof EditorProjectRepositoryError
						? cause
						: new EditorProjectRepositoryError({
								operation: "refresh-project",
								message: "The editor project refresh could not acquire ownership.",
								cause,
							}),
			}),
			() =>
				Effect.gen(function* () {
					const repository = yield* EditorProjectRepository;
					const unsavedChanges = yield* EditorUnsavedChanges;
					yield* repository.awaitIdleFx;
					const current = yield* Atom.get(EditorProjectAtom(projectId));
					yield* Effect.uninterruptible(
						Effect.gen(function* () {
							yield* releaseCurrentEditorBoardGameFx;
							const fresh = yield* requestRefreshFx(projectId).pipe(
								Effect.tapError(() =>
									current === undefined
										? Effect.void
										: syncEditorBoardGameFx(current).pipe(Effect.ignore),
								),
							);
							yield* Effect.sync(() => unsavedChanges.discardAll());
							yield* publishEditorProjectFx(projectId, {
								replacement: fresh,
							});
							yield* syncEditorBoardGameFx(fresh);
							yield* Atom.update(
								EditorProjectReplacementEpochAtom(projectId),
								(epoch) => epoch + 1,
							);
						}),
					);
				}),
			(release) => Effect.sync(release),
		),
);
