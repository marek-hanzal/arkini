import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { makeDropRejectedResultFn } from "~/engine/runtime/drop/fn/makeDropRejectedResultFn";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";

export namespace makeDropActorRejectedResultFx {
	export interface Props {
		readonly failedItemId: IdSchema.Type | undefined;
		readonly failure: "invalid-location" | "stale";
		readonly sourceItemId: IdSchema.Type;
		readonly targetItemId: IdSchema.Type;
	}
}

/** Maps one optimistic source/target actor race into the canonical rejected-drop reason. */
export const makeDropActorRejectedResultFx = Effect.fnUntraced(function* ({
	failedItemId,
	failure,
	sourceItemId,
	targetItemId,
}: makeDropActorRejectedResultFx.Props) {
	const targetFailed = failedItemId === targetItemId;
	return makeDropRejectedResultFn({
		reason:
			failure === "stale"
				? targetFailed
					? DropItemRejectedReason.StaleTarget
					: DropItemRejectedReason.StaleSource
				: targetFailed
					? DropItemRejectedReason.InvalidTarget
					: DropItemRejectedReason.InvalidSource,
		sourceItemId,
		targetItemId,
	});
});
