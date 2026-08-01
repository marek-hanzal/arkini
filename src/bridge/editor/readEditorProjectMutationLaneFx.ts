import { Deferred, Effect, Semaphore } from "effect";

import {
	EditorProjectMutationLanes,
	type EditorProjectMutationLane,
} from "~/bridge/editor/internal/EditorProjectMutationLaneState";

const createCompletedIdle = () => {
	const idle = Deferred.makeUnsafe<void>();
	Deferred.doneUnsafe(idle, Effect.void);
	return idle;
};

/** Reads or creates the process-local canonical mutation lane for one editor project. */
export const readEditorProjectMutationLaneFx = Effect.fn("readEditorProjectMutationLaneFx")(
	(projectId: string) =>
		Effect.sync((): EditorProjectMutationLane => {
			const existing = EditorProjectMutationLanes.get(projectId);
			if (existing !== undefined) return existing;
			const created: EditorProjectMutationLane = {
				accepting: true,
				idle: createCompletedIdle(),
				lineage: new Set(),
				pendingCount: 0,
				semaphore: Semaphore.makeUnsafe(1),
			};
			EditorProjectMutationLanes.set(projectId, created);
			return created;
		}),
);
