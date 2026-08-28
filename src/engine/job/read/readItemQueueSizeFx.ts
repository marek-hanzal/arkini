import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";

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
				type: P.union(TypeSchema.enum.Deposit, TypeSchema.enum.Producer),
			},
			({ maxQueueSize }) => maxQueueSize,
		)
		.with(
			{
				type: P.union(TypeSchema.enum.Blueprint, TypeSchema.enum.Craft),
			},
			() => 1,
		)
		.with(
			{
				type: TypeSchema.enum.Stash,
			},
			() => 1,
		)
		.otherwise(() => undefined) satisfies PositiveIntegerSchema.Type | undefined;
});
