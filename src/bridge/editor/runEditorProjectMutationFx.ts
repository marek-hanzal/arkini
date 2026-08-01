import { Deferred, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import type { EditorProjectMutationLane } from "~/bridge/editor/internal/EditorProjectMutationLaneState";
import { readEditorProjectMutationLaneFx } from "~/bridge/editor/readEditorProjectMutationLaneFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

export namespace runEditorProjectMutationFx {
	export interface Result {
		readonly project: EditorProject;
		readonly revision: string;
	}

	export interface Props<MutationResult extends Result> {
		readonly expectedRevision: string;
		readonly projectId: string;
		readonly run: (
			expectedRevision: string,
		) => Effect.Effect<MutationResult, unknown, AtomRegistry.AtomRegistry>;
	}
}

const createRevisionConflict = (projectId: string) =>
	new EditorProjectError({
		reason: "unsupported-project-file",
		message: `Editor project ${projectId} changed before its queued mutation could run.`,
	});

const admitMutation = (lane: EditorProjectMutationLane, expectedRevision: string) => {
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
export const runEditorProjectMutationFx = Effect.fn("runEditorProjectMutationFx")(function* <
	MutationResult extends runEditorProjectMutationFx.Result,
>({ expectedRevision, projectId, run }: runEditorProjectMutationFx.Props<MutationResult>) {
	const lane = yield* readEditorProjectMutationLaneFx(projectId);
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
	return yield* runMutation.pipe(
		Effect.uninterruptible,
		Effect.ensuring(Effect.sync(releaseAdmission)),
	);
});
