import { Deferred, Effect } from "effect";

import { readEditorProjectMutationLaneFx } from "~/bridge/editor/readEditorProjectMutationLaneFx";

/** Stops new writes and drains every mutation already admitted for one project. */
export const closeEditorProjectMutationLaneFx = Effect.fn("closeEditorProjectMutationLaneFx")(
	(projectId: string) =>
		readEditorProjectMutationLaneFx(projectId).pipe(
			Effect.tap((lane) =>
				Effect.sync(() => {
					lane.accepting = false;
				}),
			),
			Effect.flatMap((lane) =>
				lane.pendingCount === 0 ? Effect.void : Deferred.await(lane.idle),
			),
		),
);
