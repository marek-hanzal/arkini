import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { EditorProjectRepository } from "~/editor/EditorProjectRepository";
import { EditorProjectReplacementEpochAtom } from "~/ui/editor/EditorProjectReplacementEpochAtom";
import { EditorUnsavedChanges } from "~/renderer/editor/unsaved/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/renderer/editor/EditorProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/renderer/editor/board/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/renderer/editor/board/syncEditorBoardGameFx";
import { publishEditorProjectFx } from "~/ui/editor/publishEditorProjectFx";
import { readEditorProjectFx } from "~/editor/project/fx/readEditorProjectFx";
import { EditorProjectVersionCheckoutConfirmationRequired } from "~/ui/version/editor/EditorProjectVersionCheckoutConfirmationRequired";
import { reloadEditorProjectAfterVersionRefreshFailureFx } from "~/ui/version/editor/reloadEditorProjectAfterVersionRefreshFailureFx";

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
