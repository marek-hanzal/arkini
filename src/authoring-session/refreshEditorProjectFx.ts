import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProjectTransport } from "../../electron/contract/editor/EditorProjectTransport";
import { EditorProjectPayloadSchema } from "~/project-authoring/EditorProjectPayloadSchema";
import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { EditorProjectRepositoryError } from "~/project-authoring/repository/EditorProjectRepositoryError";
import { EditorProjectAtom } from "~/authoring-session/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/authoring-session/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/project-authoring/repository/EditorProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/board-scenario/session/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/board-scenario/session/syncEditorBoardGameFx";
import { invokeEditorProjectTransportFx } from "~/project-authoring/repository/invokeEditorProjectTransportFx";
import { publishEditorProjectFx } from "~/authoring-session/publishEditorProjectFx";

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
			return EditorProjectPayloadSchema.parse(candidate);
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
					return yield* Effect.uninterruptible(
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
							if (fresh.projectId === projectId) {
								yield* publishEditorProjectFx(projectId, {
									replacement: fresh,
								});
								yield* syncEditorBoardGameFx(fresh);
								yield* Atom.update(
									EditorProjectReplacementEpochAtom(projectId),
									(epoch) => epoch + 1,
								);
							}
							return fresh;
						}),
					);
				}),
			(release) => Effect.sync(release),
		),
);
