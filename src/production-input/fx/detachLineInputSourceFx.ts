import { Effect } from "effect";

import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
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
				readonly insertionIndex: number;
				readonly runtime: RuntimeSchema.Type;
		  };
}

/**
 * Detaches one idle material source while atomically discarding its default-line intent.
 *
 * Active or queued work refuses detachment. The source keeps its passive input subtree through
 * delivery and storage; only consume-mode job start discards it. Returning that subtree here
 * would also occupy the origin cell which the source's delivery must keep leased.
 * Incoming deliveries turn home because their target is leaving the Board.
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

	const withoutIdentityState = yield* discardRuntimeItemIdentityStateFx({
		ownerItemIds: new Set([
			source.id,
		]),
		runtime,
	});
	const detachedRuntime = {
		...withoutIdentityState,
		items: withoutIdentityState.items.filter((candidate) => candidate.id !== source.id),
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

	return {
		type: "detached",
		insertionIndex: sourceIndex,
		runtime: reconciledRuntime,
	} satisfies detachLineInputSourceFx.Result;
});
