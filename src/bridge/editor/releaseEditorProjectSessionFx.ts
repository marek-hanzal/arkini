import { Effect } from "effect";

import { EditorProjectSessionState } from "~/bridge/editor/internal/EditorProjectSessionState";
import { releaseEditorProjectMutationLaneFx } from "~/bridge/editor/releaseEditorProjectMutationLaneFx";

/** Releases one closed editor project session and its inactive mutation lane. */
export const releaseEditorProjectSessionFx = Effect.fn("releaseEditorProjectSessionFx")(
	(projectId: string) =>
		releaseEditorProjectMutationLaneFx(projectId).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					if (EditorProjectSessionState.activeProjectId === projectId) {
						EditorProjectSessionState.activeProjectId = undefined;
					}
				}),
			),
		),
);
