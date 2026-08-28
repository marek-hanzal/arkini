import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

type RejectedDropResult = Extract<
	DropItemResultSchema.Type,
	{
		readonly kind: typeof DropItemResultKindEnumSchema.enum.Reject;
	}
>;

export namespace makeDropRejectedResultFx {
	export interface Props {
		readonly reason: DropItemRejectedReasonEnumSchema.Type;
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
		kind: DropItemResultKindEnumSchema.enum.Reject,
		reason,
		itemId: sourceItemId,
		...(targetItemId === undefined
			? {}
			: {
					targetItemId,
				}),
	} satisfies RejectedDropResult;
});
