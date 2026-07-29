import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace discardRuntimeItemIdentityStateFx {
	export interface Props {
		readonly ownerItemIds: ReadonlySet<IdSchema.Type>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Discards every passive runtime intent bound to identities that can no longer act as owners. */
export const discardRuntimeItemIdentityStateFx = Effect.fn("discardRuntimeItemIdentityStateFx")(
	function* ({ ownerItemIds, runtime }: discardRuntimeItemIdentityStateFx.Props) {
		const defaultLineByOwnerItemId = {
			...(runtime.defaultLineByOwnerItemId ?? {}),
		};
		for (const ownerItemId of ownerItemIds) {
			delete defaultLineByOwnerItemId[ownerItemId];
		}
		return {
			...runtime,
			jobQueue: (runtime.jobQueue ?? []).filter(
				(request) => !ownerItemIds.has(request.ownerItemId),
			),
			deliveryStartIntents: (runtime.deliveryStartIntents ?? []).filter(
				(intent) => !ownerItemIds.has(intent.ownerItemId),
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
