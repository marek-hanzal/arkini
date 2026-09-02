import type { IdSchema } from "~/game-value/schema/IdSchema";
import { makeDropRejectedResultFn } from "~/item-interaction/fn/makeDropRejectedResultFn";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";

export namespace makeDropActorRejectedResultFn {
	export interface Props {
		readonly failedItemId: IdSchema.Type | undefined;
		readonly failure: "invalid-location" | "stale";
		readonly sourceItemId: IdSchema.Type;
		readonly targetItemId: IdSchema.Type;
	}
}

/** Maps one optimistic source/target actor race into the canonical rejected-drop reason. */
export const makeDropActorRejectedResultFn = ({
	failedItemId,
	failure,
	sourceItemId,
	targetItemId,
}: makeDropActorRejectedResultFn.Props) => {
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
};
