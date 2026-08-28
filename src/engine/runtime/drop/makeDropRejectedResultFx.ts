import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import type { DropItemResult } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";

type RejectedDropResult = Extract<
	DropItemResult,
	{
		readonly kind: typeof DropItemResultKind.Reject;
	}
>;

export namespace makeDropRejectedResultFx {
	export interface Props {
		readonly reason: DropItemRejectedReason;
		readonly sourceItemId: IdSchema.Type;
		readonly targetItemId?: IdSchema.Type;
	}
}

/** Normalizes an expected optimistic drop race into the public rejected result. */
export const makeDropRejectedResultFx = Effect.fnUntraced(function* ({
	reason,
	sourceItemId,
	targetItemId,
}: makeDropRejectedResultFx.Props) {
	return {
		kind: DropItemResultKind.Reject,
		reason,
		itemId: sourceItemId,
		...(targetItemId === undefined
			? {}
			: {
					targetItemId,
				}),
	} satisfies RejectedDropResult;
});
