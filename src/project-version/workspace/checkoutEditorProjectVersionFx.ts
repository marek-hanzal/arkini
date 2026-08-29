import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/project-authoring/repository/EditorProjectRepository";
import { EditorProjectReplacementEpochAtom } from "~/authoring-session/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/authoring-session/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/project-authoring/repository/EditorProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/board-scenario/session/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/board-scenario/session/syncEditorBoardGameFx";
import { publishEditorProjectFx } from "~/authoring-session/publishEditorProjectFx";
import { readEditorProjectFx } from "~/project-authoring/readEditorProjectFx";
import { EditorProjectVersionCheckoutConfirmationRequired } from "~/project-version/workspace/EditorProjectVersionCheckoutConfirmationRequired";

const reloadEditorProjectAfterVersionRefreshFailureFx = Effect.fn(
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

export namespace checkoutEditorProjectVersionFx {
	export interface Props {
		readonly confirmDiscardCurrentChanges: boolean;
		readonly projectId: string;
		readonly versionId: string;
	}
}

/** Performs the terminal renderer handshake before one persisted project replacement. */
export const checkoutEditorProjectVersionFx = Effect.fn("checkoutEditorProjectVersionFx")(
	({
		confirmDiscardCurrentChanges,
		projectId,
		versionId,
	}: checkoutEditorProjectVersionFx.Props) =>
		Effect.acquireUseRelease(
			Effect.sync(blockEditorProjectWrites),
			() =>
				Effect.gen(function* () {
					const repository = yield* EditorProjectRepository;
					const unsavedChanges = yield* EditorUnsavedChanges;
					yield* repository.awaitIdleFx;
					const status = yield* repository.readVersionStatusFx(projectId);
					if (status.dirty && !confirmDiscardCurrentChanges)
						return yield* Effect.fail(
							new EditorProjectVersionCheckoutConfirmationRequired(),
						);
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
								const fresh = yield* readEditorProjectFx({
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
									reloadEditorProjectAfterVersionRefreshFailureFx({
										cause,
										projectId,
									}),
								),
							);
						}),
					);
				}),
			(release) => Effect.sync(release),
		),
);
