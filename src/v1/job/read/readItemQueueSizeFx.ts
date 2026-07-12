import { Effect } from "effect";
import { match } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";

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
				type: "craft",
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
