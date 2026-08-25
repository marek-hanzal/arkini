import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorUnsavedChanges } from "~/bridge/editor/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/bridge/editor/EditorProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/bridge/editor/board/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";
import { EditorProjectVersionCheckoutConfirmationRequired } from "~/bridge/editor/version/EditorProjectVersionCheckoutConfirmationRequired";

export namespace checkoutEditorProjectVersionFx {
	export interface Props {
		readonly confirmDiscardCurrentChanges: boolean;
		readonly currentProject: EditorProject;
		readonly hardReload: (projectId: string) => void;
		readonly versionId: string;
	}
}

/** Performs the terminal renderer handshake before one atomic SQLite project replacement. */
export const checkoutEditorProjectVersionFx = Effect.fn("checkoutEditorProjectVersionFx")(
	({
		confirmDiscardCurrentChanges,
		currentProject,
		hardReload,
		versionId,
	}: checkoutEditorProjectVersionFx.Props) =>
		Effect.acquireUseRelease(
			Effect.sync(blockEditorProjectWrites),
			() =>
				Effect.gen(function* () {
					const repository = yield* EditorProjectRepository;
					const unsavedChanges = yield* EditorUnsavedChanges;
					yield* repository.awaitIdleFx;
					const status = yield* repository.readVersionStatusFx(currentProject.projectId);
					if (status.dirty && !confirmDiscardCurrentChanges)
						return yield* Effect.fail(
							new EditorProjectVersionCheckoutConfirmationRequired(),
						);
					yield* releaseCurrentEditorBoardGameFx;
					const checkout = yield* repository
						.checkoutVersionFx({
							expectedFingerprint: status.currentFingerprint,
							projectId: currentProject.projectId,
							versionId,
						})
						.pipe(
							Effect.tapError(() =>
								repository.readProjectFx(currentProject.projectId).pipe(
									Effect.flatMap((latest) =>
										latest === null
											? Effect.void
											: syncEditorBoardGameFx(latest),
									),
									Effect.ignore,
								),
							),
						);
					unsavedChanges.discardAll();
					hardReload(currentProject.projectId);
					return checkout;
				}),
			(release) => Effect.sync(release),
		),
);
