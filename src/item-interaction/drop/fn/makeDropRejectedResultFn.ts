import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { DropItemRejectedReason } from "~/item-interaction/DropItemResult";
import type { DropItemResult } from "~/item-interaction/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";

type RejectedDropResult = Extract<
	DropItemResult,
	{
		readonly kind: typeof DropItemResultKind.Reject;
	}
>;

export namespace makeDropRejectedResultFn {
	export interface Props {
		readonly reason: DropItemRejectedReason;
		readonly sourceItemId: IdSchema.Type;
		readonly targetItemId?: IdSchema.Type;
	}
}

/** Normalizes an expected optimistic drop race into the public rejected result. */
export const makeDropRejectedResultFn = ({
	reason,
	sourceItemId,
	targetItemId,
}: makeDropRejectedResultFn.Props) => {
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
};
