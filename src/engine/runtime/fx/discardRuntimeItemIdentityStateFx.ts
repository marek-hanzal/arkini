import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { JobOwnerBusyError } from "~/production-job/error/JobOwnerBusyError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace discardRuntimeItemIdentityStateFx {
	export interface Props {
		readonly ownerItemIds: ReadonlySet<IdSchema.Type>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Discards default-line intent only after proving that no pending work owns the identities. */
export const discardRuntimeItemIdentityStateFx = Effect.fn("discardRuntimeItemIdentityStateFx")(
	function* ({ ownerItemIds, runtime }: discardRuntimeItemIdentityStateFx.Props) {
		const queuedRequests = runtime.jobQueue.filter((request) =>
			ownerItemIds.has(request.ownerItemId),
		);
		const queuedOwnerItemId = queuedRequests[0]?.ownerItemId;
		if (queuedOwnerItemId !== undefined) {
			return yield* Effect.fail(
				new JobOwnerBusyError({
					ownerItemId: queuedOwnerItemId,
					jobIds: [],
					requestIds: queuedRequests.map((request) => request.id),
				}),
			);
		}

		const defaultLineByOwnerItemId = {
			...runtime.defaultLineByOwnerItemId,
		};
		for (const ownerItemId of ownerItemIds) {
			delete defaultLineByOwnerItemId[ownerItemId];
		}
		return {
			...runtime,
			defaultLineByOwnerItemId,
		} satisfies RuntimeSchema.Type;
	},
);
