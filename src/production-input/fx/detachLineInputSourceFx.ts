import { Effect } from "effect";

import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import { releaseOwnerInputsFx } from "~/production-input/fx/releaseOwnerInputsFx";
import { discardRuntimeItemIdentityStateFx } from "~/game-runtime/fx/discardRuntimeItemIdentityStateFx";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace detachLineInputSourceFx {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
		readonly source: GridRuntimeItemSchema.Type;
	}

	export type Result =
		| {
				readonly type: "active-job";
				readonly jobIds: readonly IdSchema.Type[];
		  }
		| {
				readonly type: "detached";
				readonly events: readonly GameEventSchema.Type[];
				readonly insertionIndex: number;
				readonly runtime: RuntimeSchema.Type;
		  };
}

/**
 * Detaches one idle material source while atomically discarding its default-line intent.
 *
 * Active or queued work refuses detachment. Buffered inputs return through canonical placement,
 * and inbound deliveries reconcile against the released origin before the caller commits the
 * source elsewhere.
 */
export const detachLineInputSourceFx = Effect.fn("detachLineInputSourceFx")(function* ({
	runtime,
	source,
}: detachLineInputSourceFx.Props) {
	const jobIds = runtime.jobs.filter((job) => job.ownerItemId === source.id).map((job) => job.id);
	if (jobIds.length > 0) {
		return {
			type: "active-job",
			jobIds,
		} satisfies detachLineInputSourceFx.Result;
	}
	const sourceIndex = runtime.items.findIndex((candidate) => candidate.id === source.id);
	const followingItemIds = new Set(
		runtime.items.slice(sourceIndex + 1).map((candidate) => candidate.id),
	);
	const precedingItemIds = new Set(
		runtime.items.slice(0, sourceIndex).map((candidate) => candidate.id),
	);

	const withoutIdentityState = yield* discardRuntimeItemIdentityStateFx({
		ownerItemIds: new Set([
			source.id,
		]),
		runtime,
	});
	const releasedInputs = yield* releaseOwnerInputsFx({
		owner: source,
		runtime: withoutIdentityState,
	});
	const detachedRuntime = {
		...releasedInputs.runtime,
		items: releasedInputs.runtime.items.filter((candidate) => candidate.id !== source.id),
	} satisfies RuntimeSchema.Type;
	const reconciledRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
		returnFromByOwnerItemId: new Map([
			[
				source.id,
				source.location,
			],
		]),
		runtime: detachedRuntime,
	});
	const followingIndex = reconciledRuntime.items.findIndex((candidate) =>
		followingItemIds.has(candidate.id),
	);
	const precedingIndex = reconciledRuntime.items.reduce(
		(index, candidate, candidateIndex) =>
			precedingItemIds.has(candidate.id) ? candidateIndex : index,
		-1,
	);

	return {
		type: "detached",
		events: releasedInputs.events,
		insertionIndex: followingIndex === -1 ? precedingIndex + 1 : followingIndex,
		runtime: reconciledRuntime,
	} satisfies detachLineInputSourceFx.Result;
});
