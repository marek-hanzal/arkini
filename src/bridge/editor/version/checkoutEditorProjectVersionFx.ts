import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { EditorUnsavedChanges } from "~/bridge/editor/EditorUnsavedChanges";
import { blockEditorProjectWrites } from "~/bridge/editor/EditorProjectWriteAdmission";
import { releaseCurrentEditorBoardGameFx } from "~/bridge/editor/board/releaseCurrentEditorBoardGameFx";
import { syncEditorBoardGameFx } from "~/bridge/editor/board/syncEditorBoardGameFx";

export namespace checkoutEditorProjectVersionFx {
	export interface Props {
		readonly currentProject: EditorProject;
		readonly versionId: string;
	}
}

/** Performs the terminal renderer handshake before one atomic SQLite project replacement. */
export const checkoutEditorProjectVersionFx = Effect.fn("checkoutEditorProjectVersionFx")(
	({ currentProject, versionId }: checkoutEditorProjectVersionFx.Props) =>
		Effect.acquireUseRelease(
			Effect.sync(blockEditorProjectWrites),
			() =>
				Effect.gen(function* () {
					const repository = yield* EditorProjectRepository;
					const unsavedChanges = yield* EditorUnsavedChanges;
					unsavedChanges.discardAll();
					yield* repository.awaitIdleFx;
					const status = yield* repository.readVersionStatusFx(currentProject.projectId);
					yield* releaseCurrentEditorBoardGameFx;
					return yield* repository
						.checkoutVersionFx({
							expectedFingerprint: status.currentFingerprint,
							projectId: currentProject.projectId,
							versionId,
						})
						.pipe(
							Effect.tapError(() =>
								syncEditorBoardGameFx(currentProject).pipe(Effect.ignore),
							),
						);
				}),
			(release) => Effect.sync(release),
		),
);
