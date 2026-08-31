import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { ProjectPayloadSchema } from "~/project-authoring/schema/ProjectPayloadSchema";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/board-scenario/fx/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/board-scenario/fx/syncEditorBoardGameFx";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";

export namespace refreshEditorProjectFx {
	export interface Props {
		readonly projectId: string;
	}
}

const requestRefreshFx = (projectId: string) =>
	invokeProjectTransportFx({
		callFn: () => window.arkini.editor.refreshProjectFn(projectId),
		operation: "refresh-project",
		parseFn: (candidate: EditorProjectTransport.Project) => {
			return ProjectPayloadSchema.parse(candidate);
		},
		requestMessage: "The editor project refresh request failed.",
		responseMessage: "The editor project refresh response is invalid.",
	});

const acquireProjectRefreshFx = Effect.flatMap(ProjectWriteAdmission, (admission) =>
	admission.acquireReplacementFx("refresh-project"),
);

/** Hard-replaces the mounted project with its authoritative Editor-folder state. */
export const refreshEditorProjectFx = Effect.fn("refreshEditorProjectFx")(
	({ projectId }: refreshEditorProjectFx.Props) =>
		Effect.acquireUseRelease(
			acquireProjectRefreshFx,
			() =>
				Effect.gen(function* () {
					const repository = yield* ProjectRepository;
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
							yield* Effect.sync(() => unsavedChanges.discardAllFn());
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
			(releaseFx) => releaseFx,
		),
);
