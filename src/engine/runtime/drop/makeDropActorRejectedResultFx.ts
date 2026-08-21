import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { makeDropRejectedResultFx } from "~/engine/runtime/drop/makeDropRejectedResultFx";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";

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
					? DropItemRejectedReasonEnumSchema.enum.StaleTarget
					: DropItemRejectedReasonEnumSchema.enum.StaleSource
				: targetFailed
					? DropItemRejectedReasonEnumSchema.enum.InvalidTarget
					: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
		sourceItemId,
		targetItemId,
	});
});
