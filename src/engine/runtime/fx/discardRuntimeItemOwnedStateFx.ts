import { Effect } from "effect";

import { reconcileOutboundDeliveriesRuntimeFx } from "~/engine/delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { JobOwnerBusyError } from "~/engine/job/error/JobOwnerBusyError";
import { discardRuntimeItemIdentityStateFx } from "~/engine/runtime/fx/discardRuntimeItemIdentityStateFx";
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
 * The root object survives for its caller's consume/remove transition, but identity-bound intents
 * for the complete ownership tree are discarded. Active jobs and their committed materials remain
 * strict precondition failures.
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
