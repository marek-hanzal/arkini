import type { Deferred, Semaphore } from "effect";

export interface EditorProjectMutationLane {
	accepting: boolean;
	idle: Deferred.Deferred<void>;
	readonly lineage: Set<string>;
	pendingCount: number;
	readonly semaphore: Semaphore.Semaphore;
	headRevision?: string;
}

/** Process-local canonical write lanes keyed by editor project ID. */
export const EditorProjectMutationLanes = new Map<string, EditorProjectMutationLane>();
