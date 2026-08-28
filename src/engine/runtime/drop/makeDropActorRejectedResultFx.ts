import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { makeDropRejectedResultFx } from "~/engine/runtime/drop/makeDropRejectedResultFx";
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
	return yield* makeDropRejectedResultFx({
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
