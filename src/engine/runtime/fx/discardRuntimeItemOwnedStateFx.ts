import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { JobOwnerBusyError } from "~/engine/job/error/JobOwnerBusyError";
import { readRuntimeItemOwnedStateFx } from "~/engine/runtime/read/readRuntimeItemOwnedStateFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace discardRuntimeItemOwnedStateFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Permanently discards passive input-owned state beneath one item identity.
 *
 * The root survives. Queued intents owned by the discarded tree are removed,
 * but active jobs and their committed materials are strict precondition failures.
 */
export const discardRuntimeItemOwnedStateFx = Effect.fn("discardRuntimeItemOwnedStateFx")(
	function* ({ ownerItemId, runtime }: discardRuntimeItemOwnedStateFx.Props) {
		const owned = yield* readRuntimeItemOwnedStateFx({
			ownerItemId,
			runtime,
		});
		if (owned.jobs.length > 0 || owned.jobItems.length > 0) {
			return yield* Effect.fail(
				new JobOwnerBusyError({
					ownerItemId,
					jobIds: owned.jobs.map((job) => job.id),
					requestIds: [],
				}),
			);
		}

		const discardedItemIds = new Set(owned.inputItems.map((item) => item.id));
		const defaultLineByOwnerItemId = {
			...(runtime.defaultLineByOwnerItemId ?? {}),
		};
		for (const discardedItemId of discardedItemIds) {
			delete defaultLineByOwnerItemId[discardedItemId];
		}
		return {
			...runtime,
			items: runtime.items.filter((item) => !discardedItemIds.has(item.id)),
			jobQueue: (runtime.jobQueue ?? []).filter(
				(request) => !owned.ownerItemIds.has(request.ownerItemId),
			),
			...(Object.keys(defaultLineByOwnerItemId).length === 0
				? {
						defaultLineByOwnerItemId: undefined,
					}
				: {
						defaultLineByOwnerItemId,
					}),
		} satisfies RuntimeSchema.Type;
	},
);
