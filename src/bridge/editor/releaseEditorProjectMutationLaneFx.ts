import { Effect } from "effect";

import { EditorProjectMutationLanes } from "~/bridge/editor/internal/EditorProjectMutationLaneState";

/** Releases one inactive canonical mutation lane after its editor session closes. */
export const releaseEditorProjectMutationLaneFx = Effect.fn("releaseEditorProjectMutationLaneFx")(
	(projectId: string) =>
		Effect.sync(() => {
			const lane = EditorProjectMutationLanes.get(projectId);
			if (lane?.pendingCount === 0) EditorProjectMutationLanes.delete(projectId);
		}),
);
