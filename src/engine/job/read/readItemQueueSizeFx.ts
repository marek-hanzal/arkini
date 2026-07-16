import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

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
				type: "producer",
			},
			({ maxQueueSize }) => maxQueueSize,
		)
		.with(
			{
				type: P.union("blueprint", "craft"),
			},
			() => 1,
		)
		.with(
			{
				type: "stash",
			},
			() => 1,
		)
		.otherwise(() => undefined) satisfies PositiveIntegerSchema.Type | undefined;
});
