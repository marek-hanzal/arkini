import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { JobOwnerBusyError } from "~/v1/job/error/JobOwnerBusyError";
import { readRuntimeItemOwnedStateFx } from "~/v1/runtime/read/readRuntimeItemOwnedStateFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
		return {
			...runtime,
			items: runtime.items.filter((item) => !discardedItemIds.has(item.id)),
			jobQueue: (runtime.jobQueue ?? []).filter(
				(request) => !owned.ownerItemIds.has(request.ownerItemId),
			),
		} satisfies RuntimeSchema.Type;
	},
);
