import { Effect, Exit, Semaphore } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { admitEditorProjectCanonicalMutation } from "~/bridge/editor/EditorProjectSessionState";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export interface EditorProjectMutationResult {
	readonly project: EditorProject;
	readonly revision: string;
}

interface ProjectMutationLane {
	readonly semaphore: Semaphore.Semaphore;
	readonly lineage: Set<string>;
	headRevision?: string;
	pendingCount: number;
}

const lanes = new Map<string, ProjectMutationLane>();

/** Tracks admitted source mutations so editor exit cannot race their completion. */
export const EditorProjectMutationPendingAtom = Atom.family((_projectId: string) =>
	Atom.make(0).pipe(Atom.keepAlive),
);

const readLane = (projectId: string) => {
	const existing = lanes.get(projectId);
	if (existing !== undefined) return existing;
	const created: ProjectMutationLane = {
		semaphore: Semaphore.makeUnsafe(1),
		lineage: new Set(),
		pendingCount: 0,
	};
	lanes.set(projectId, created);
	return created;
};

const createRevisionConflict = (projectId: string) =>
	new EditorProjectError({
		reason: "unsupported-project-file",
		message: `Editor project ${projectId} changed before its queued mutation could run.`,
	});

/**
 * Admits one mutation immediately and runs it through the project-wide Effect
 * semaphore. The local lineage exists only while that admitted batch is alive.
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
	const registry = yield* AtomRegistry.AtomRegistry;
	const releaseAdmission = admitEditorProjectCanonicalMutation(projectId);
	if (releaseAdmission === undefined) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${projectId} is closing and no longer accepts mutations.`,
			}),
		);
	}
	const lane = readLane(projectId);
	const pendingAtom = EditorProjectMutationPendingAtom(projectId);
	if (lane.pendingCount === 0) {
		lane.headRevision = expectedRevision;
		lane.lineage.clear();
		lane.lineage.add(expectedRevision);
	}
	lane.pendingCount += 1;
	registry.update(pendingAtom, (pending) => pending + 1);
	const releaseLane = Effect.sync(() => {
		lane.pendingCount = Math.max(0, lane.pendingCount - 1);
		registry.update(pendingAtom, (pending) => Math.max(0, pending - 1));
		if (lane.pendingCount > 0) return;
		lane.headRevision = undefined;
		lane.lineage.clear();
		if (lanes.get(projectId) === lane) lanes.delete(projectId);
	});
	const runMutation = lane.semaphore
		.withPermit(
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
		)
		.pipe(Effect.ensuring(releaseLane));
	return yield* runMutation.pipe(Effect.ensuring(Effect.sync(releaseAdmission)));
});
