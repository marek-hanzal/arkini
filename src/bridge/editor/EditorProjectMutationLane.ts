import { Deferred, Effect, Exit, Semaphore } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export interface EditorProjectMutationResult {
	readonly project: EditorProject;
	readonly revision: string;
}

interface ProjectMutationLane {
	accepting: boolean;
	idle: Deferred.Deferred<void>;
	readonly lineage: Set<string>;
	pendingCount: number;
	readonly semaphore: Semaphore.Semaphore;
	headRevision?: string;
}

const lanes = new Map<string, ProjectMutationLane>();

const createCompletedIdle = () => {
	const idle = Deferred.makeUnsafe<void>();
	Deferred.doneUnsafe(idle, Effect.void);
	return idle;
};

const readLane = (projectId: string) => {
	const existing = lanes.get(projectId);
	if (existing !== undefined) return existing;
	const created: ProjectMutationLane = {
		accepting: true,
		idle: createCompletedIdle(),
		lineage: new Set(),
		pendingCount: 0,
		semaphore: Semaphore.makeUnsafe(1),
	};
	lanes.set(projectId, created);
	return created;
};

const createRevisionConflict = (projectId: string) =>
	new EditorProjectError({
		reason: "unsupported-project-file",
		message: `Editor project ${projectId} changed before its queued mutation could run.`,
	});

/** Opens one project mutation lane for canonical writes. */
export const openEditorProjectMutationLane = (projectId: string) => {
	readLane(projectId).accepting = true;
};

/** Reopens canonical write admission after a failed close attempt. */
export const resumeEditorProjectMutationLane = (projectId: string) => {
	readLane(projectId).accepting = true;
};

/** Stops new writes and drains every mutation already admitted for one project. */
export const closeEditorProjectMutationLaneFx = Effect.fn(
	"closeEditorProjectMutationLaneFx",
)((projectId: string) =>
	Effect.suspend(() => {
		const lane = readLane(projectId);
		lane.accepting = false;
		return lane.pendingCount === 0 ? Effect.void : Deferred.await(lane.idle);
	}),
);

/** Releases one inactive lane after the owning editor session has closed. */
export const releaseEditorProjectMutationLane = (projectId: string) => {
	const lane = lanes.get(projectId);
	if (lane?.pendingCount === 0) lanes.delete(projectId);
};

const admitMutation = (lane: ProjectMutationLane, expectedRevision: string) => {
	if (!lane.accepting) return undefined;
	if (lane.pendingCount === 0) {
		lane.idle = Deferred.makeUnsafe<void>();
		lane.headRevision = expectedRevision;
		lane.lineage.clear();
		lane.lineage.add(expectedRevision);
	}
	lane.pendingCount += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		lane.pendingCount = Math.max(0, lane.pendingCount - 1);
		if (lane.pendingCount > 0) return;
		lane.headRevision = undefined;
		lane.lineage.clear();
		Deferred.doneUnsafe(lane.idle, Effect.void);
	};
};

/**
 * The sole canonical project-write authority.
 *
 * It admits writes synchronously, serializes them through one Effect semaphore,
 * advances the queued revision lineage, publishes the resulting canonical project,
 * and exposes one close/drain boundary through the same lane state.
 */
export const runEditorProjectMutationFx = Effect.fn("runEditorProjectMutationFx")(function* ({
	expectedRevision,
	projectId,
	run,
}: {
	readonly expectedRevision: string;
	readonly projectId: string;
	readonly run: (
		expectedRevision: string,
	) => Effect.Effect<EditorProjectMutationResult, unknown, AtomRegistry.AtomRegistry>;
}) {
	const lane = readLane(projectId);
	const releaseAdmission = admitMutation(lane, expectedRevision);
	if (releaseAdmission === undefined) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} is closing and no longer accepts mutations.`,
			}),
		);
	}
	const runMutation = lane.semaphore.withPermit(
		Effect.gen(function* () {
			if (lane.headRevision === undefined) {
				lane.headRevision = expectedRevision;
				lane.lineage.clear();
				lane.lineage.add(expectedRevision);
			}
			if (!lane.lineage.has(expectedRevision)) {
				return yield* Effect.fail(createRevisionConflict(projectId));
			}
			const revision = lane.headRevision;
			const exit = yield* Effect.exit(run(revision));
			if (Exit.isFailure(exit)) {
				lane.headRevision = undefined;
				lane.lineage.clear();
				return yield* Effect.failCause(exit.cause);
			}
			const result = exit.value;
			lane.headRevision = result.revision;
			lane.lineage.add(result.revision);
			yield* Atom.set(EditorProjectAtom(projectId), {
				action: "publish",
				expectedRevision: revision,
				project: result.project,
			});
			return result;
		}),
	);
	return yield* runMutation.pipe(Effect.ensuring(Effect.sync(releaseAdmission)));
});
