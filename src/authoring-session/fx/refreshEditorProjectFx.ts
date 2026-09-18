import { writeApplicationLogFx } from "~/application-diagnostics/fx/writeApplicationLogFx";
import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { EditorProjectTransport } from "~electron/contract/editor/EditorProjectTransport";
import { ProjectPayloadSchema } from "~/project-authoring/schema/ProjectPayloadSchema";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/editor-board/fx/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/editor-board/fx/syncEditorBoardGameFx";
import { invokeProjectTransportFx } from "~/project-authoring/fx/invokeProjectTransportFx";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";

export namespace refreshEditorProjectFx {
	export interface Props {
		readonly isNavigationPendingFn: () => boolean;
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

const acquireProjectRefreshFx = (isNavigationPendingFn: () => boolean) =>
	Effect.flatMap(ProjectWriteAdmission, (admission) =>
		admission.acquireReplacementFx("refresh-project", isNavigationPendingFn),
	);

/** Hard-replaces the mounted project with its authoritative Editor-folder state. */
export const refreshEditorProjectFx = Effect.fn("refreshEditorProjectFx")(function* ({
	isNavigationPendingFn,
	projectId,
}: refreshEditorProjectFx.Props) {
	const before = yield* Atom.get(EditorProjectAtom(projectId));
	let stage = "admission";
	let refreshedRevision: number | undefined;
	yield* writeApplicationLogFx({
		level: "info",
		message: "Editor refresh started",
		body: JSON.stringify({
			projectId,
			revision: before?.revision,
		}),
	});
	return yield* Effect.acquireUseRelease(
		acquireProjectRefreshFx(isNavigationPendingFn),
		() =>
			Effect.gen(function* () {
				const repository = yield* ProjectRepository;
				const unsavedChanges = yield* EditorUnsavedChanges;
				stage = "await-idle";
				yield* repository.awaitIdleFx;
				const current = yield* Atom.get(EditorProjectAtom(projectId));
				return yield* Effect.uninterruptible(
					Effect.gen(function* () {
						stage = "release-board";
						yield* releaseCurrentEditorBoardGameFx;
						stage = "read-disk";
						const fresh = yield* requestRefreshFx(projectId).pipe(
							Effect.tapError(() =>
								current === undefined
									? Effect.void
									: syncEditorBoardGameFx(current).pipe(Effect.ignore),
							),
						);
						refreshedRevision = fresh.revision;
						stage = "replace-drafts";
						yield* Effect.sync(() => unsavedChanges.discardAllFn());
						if (fresh.projectId === projectId) {
							stage = "publish-project";
							yield* publishEditorProjectFx(projectId, {
								replacement: fresh,
							});
							stage = "sync-board";
							yield* syncEditorBoardGameFx(fresh);
							stage = "replace-ui";
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
	).pipe(
		Effect.tap((fresh) =>
			writeApplicationLogFx({
				level: "info",
				message: "Editor refresh completed",
				body: JSON.stringify({
					projectId,
					previousRevision: before?.revision,
					refreshedProjectId: fresh.projectId,
					revision: fresh.revision,
				}),
			}),
		),
		Effect.onError((cause) =>
			writeApplicationLogFx({
				level: "error",
				message: "Editor refresh failed",
				body: formatApplicationDiagnosticTextFn({
					value: {
						projectId,
						previousRevision: before?.revision,
						refreshedRevision,
						stage,
						cause,
					},
				}),
			}),
		),
	);
});
