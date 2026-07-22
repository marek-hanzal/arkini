import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace readItemQueueSizeFx {
	export interface Props {
		item: ItemSchema.Type;
	}
}

/** Reads the active-job queue capacity owned by one canonical line item. */
export const readItemQueueSizeFx = Effect.fn("readItemQueueSizeFx")(function* ({
	item,
}: readItemQueueSizeFx.Props) {
	return match(item)
		.with(
			{
				type: ItemEnumSchema.enum.Producer,
			},
			({ maxQueueSize }) => maxQueueSize,
		)
		.with(
			{
				type: P.union(ItemEnumSchema.enum.Blueprint, ItemEnumSchema.enum.Craft),
			},
			() => 1,
		)
		.with(
			{
				type: ItemEnumSchema.enum.Stash,
			},
			() => 1,
		)
		.otherwise(() => undefined) satisfies PositiveIntegerSchema.Type | undefined;
});
