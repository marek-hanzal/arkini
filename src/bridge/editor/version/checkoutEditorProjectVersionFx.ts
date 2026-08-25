import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorUnsavedChanges } from "~/bridge/editor/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/bridge/editor/EditorProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/bridge/editor/board/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";
import { publishEditorProjectFx } from "~/bridge/editor/publishEditorProjectFx";
import { readEditorProjectFx } from "~/bridge/editor/readEditorProjectFx";
import { EditorProjectVersionCheckoutConfirmationRequired } from "~/bridge/editor/version/EditorProjectVersionCheckoutConfirmationRequired";
import { reloadEditorProjectAfterVersionRefreshFailureFx } from "~/bridge/editor/version/reloadEditorProjectAfterVersionRefreshFailureFx";

export namespace checkoutEditorProjectVersionFx {
	export interface Props {
		readonly confirmDiscardCurrentChanges: boolean;
		readonly projectId: string;
		readonly versionId: string;
	}
}

/** Performs the terminal renderer handshake before one atomic SQLite project replacement. */
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
