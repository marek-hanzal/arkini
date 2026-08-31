import { Effect } from "effect";

import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import { discardRuntimeItemIdentityStateFx } from "~/game-runtime/fx/discardRuntimeItemIdentityStateFx";
import { readRuntimeItemOwnedStateFn } from "~/game-runtime/read/fn/readRuntimeItemOwnedStateFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

interface DiscardRuntimeItemOwnedStateProps {
	ownerItemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}

/**
 * Permanently discards passive input-owned state beneath one idle item identity.
 *
 * The root object survives for its caller's consume/remove transition. Active or queued work
 * anywhere in the complete ownership tree is a strict precondition failure.
 */
export const discardRuntimeItemOwnedStateFx = Effect.fn("discardRuntimeItemOwnedStateFx")(
	function* ({ ownerItemId, runtime }: DiscardRuntimeItemOwnedStateProps) {
		const owned = readRuntimeItemOwnedStateFn({
			ownerItemId,
			runtime,
		});
		if (owned.jobs.length > 0 || owned.jobItems.length > 0 || owned.queue.length > 0) {
			return yield* Effect.fail(
				new JobOwnerBusyError({
					ownerItemId,
					jobIds: owned.jobs.map((job) => job.id),
					requestIds: owned.queue.map((request) => request.id),
				}),
			);
		}

		const discardedItemIds = new Set(owned.inputItems.map((item) => item.id));
		const withoutOwnedItems = {
			...runtime,
			items: runtime.items.filter((item) => !discardedItemIds.has(item.id)),
		} satisfies RuntimeSchema.Type;
		const withoutIdentityState = yield* discardRuntimeItemIdentityStateFx({
			ownerItemIds: owned.ownerItemIds,
			runtime: withoutOwnedItems,
		});
		return yield* reconcileOutboundDeliveriesRuntimeFx({
			runtime: withoutIdentityState,
		});
	},
);
