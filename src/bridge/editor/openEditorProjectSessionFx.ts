import { Effect } from "effect";

import { EditorProjectSessionState } from "~/bridge/editor/internal/EditorProjectSessionState";
import { openEditorProjectMutationLaneFx } from "~/bridge/editor/openEditorProjectMutationLaneFx";

/** Opens one canonical editor project session. */
export const openEditorProjectSessionFx = Effect.fn("openEditorProjectSessionFx")(
	(projectId: string) =>
		openEditorProjectMutationLaneFx(projectId).pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					EditorProjectSessionState.activeProjectId = projectId;
				}),
			),
			Effect.asVoid,
		),
);
