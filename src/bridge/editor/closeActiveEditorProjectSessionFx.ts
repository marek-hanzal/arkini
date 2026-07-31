import { Effect } from "effect";

import { closeEditorProjectSessionFx } from "~/bridge/editor/closeEditorProjectSessionFx";
import { EditorProjectSessionState } from "~/bridge/editor/internal/EditorProjectSessionState";
import { openEditorProjectSessionFx } from "~/bridge/editor/openEditorProjectSessionFx";

/** Closes the currently active editor project session, reopening admission on failure. */
export const closeActiveEditorProjectSessionFx = Effect.suspend(() => {
	const projectId = EditorProjectSessionState.activeProjectId;
	return projectId === undefined
		? Effect.void
		: closeEditorProjectSessionFx(projectId).pipe(
				Effect.tapError(() => openEditorProjectSessionFx(projectId)),
			);
});
