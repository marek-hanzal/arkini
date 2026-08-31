import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/atom/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/board-scenario/fx/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/board-scenario/fx/syncEditorBoardGameFx";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { readProjectFx } from "~/project-authoring/fx/readProjectFx";
import { ProjectVersionCheckoutConfirmationRequired } from "~/project-version/error/ProjectVersionCheckoutConfirmationRequired";

const reloadProjectAfterVersionRefreshFailureFx = Effect.fn(
	"reloadEditorProjectAfterVersionRefreshFailureFx",
)(({ cause, projectId }: { readonly cause: unknown; readonly projectId: string }) =>
	Effect.sync(() => {
		console.error(
			`Arkini editor project ${projectId} was restored but could not be refreshed in place. Reloading the renderer as a last resort.`,
			cause,
		);
		window.location.reload();
	}).pipe(Effect.andThen(Effect.never)),
);

export namespace checkoutProjectVersionFx {
	export interface Props {
		readonly confirmDiscardCurrentChanges: boolean;
		readonly projectId: string;
		readonly versionId: string;
	}
}

const acquireProjectVersionCheckoutFx = Effect.flatMap(ProjectWriteAdmission, (admission) =>
	admission.acquireReplacementFx("checkout-version"),
);

/** Performs the terminal renderer handshake before one persisted project replacement. */
export const checkoutProjectVersionFx = Effect.fn("checkoutEditorProjectVersionFx")(
	({ confirmDiscardCurrentChanges, projectId, versionId }: checkoutProjectVersionFx.Props) =>
		Effect.acquireUseRelease(
			acquireProjectVersionCheckoutFx,
			() =>
				Effect.gen(function* () {
					const repository = yield* ProjectRepository;
					const unsavedChanges = yield* EditorUnsavedChanges;
					yield* repository.awaitIdleFx;
					const status = yield* repository.readVersionStatusFx(projectId);
					if (status.dirty && !confirmDiscardCurrentChanges)
						return yield* Effect.fail(new ProjectVersionCheckoutConfirmationRequired());
					yield* Effect.uninterruptible(
						Effect.gen(function* () {
							yield* releaseCurrentEditorBoardGameFx;
							yield* repository
								.checkoutVersionFx({
									expectedFingerprint: status.currentFingerprint,
									projectId,
									versionId,
								})
								.pipe(
									Effect.tapError(() =>
										repository.readProjectFx(projectId).pipe(
											Effect.flatMap((latest) =>
												latest === null
													? Effect.void
													: syncEditorBoardGameFx(latest),
											),
											Effect.ignore,
										),
									),
								);
							yield* Effect.gen(function* () {
								yield* Effect.sync(() => unsavedChanges.discardAll());
								const fresh = yield* readProjectFx({
									projectId,
								});
								yield* publishEditorProjectFx(projectId, {
									project: fresh,
								});
								yield* syncEditorBoardGameFx(fresh);
								yield* Atom.update(
									EditorProjectReplacementEpochAtom(projectId),
									(epoch) => epoch + 1,
								);
							}).pipe(
								Effect.catchCause((cause) =>
									reloadProjectAfterVersionRefreshFailureFx({
										cause,
										projectId,
									}),
								),
							);
						}),
					);
				}),
			(releaseFx) => releaseFx,
		),
);
