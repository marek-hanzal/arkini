import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { LineSchema } from "~/v1/line/schema/LineSchema";

export namespace readItemLineFx {
	export interface Props {
		item: ItemSchema.Type;
		lineId: IdSchema.Type;
	}
}

/**
 * Reads one configured product line owned by a canonical item.
 */
export const readItemLineFx = Effect.fn("readItemLineFx")(function* ({
	item,
	lineId,
}: readItemLineFx.Props) {
	return match(item)
		.with(
			{
				type: "producer",
			},
			({ lines }) => lines.find((line) => line.id === lineId),
		)
		.with(
			{
				type: "craft",
			},
			({ line }) => (line.id === lineId ? line : undefined),
		)
		.with(
			{
				type: "stash",
			},
			({ line }) => (line.id === lineId ? line : undefined),
		)
		.otherwise(() => undefined) satisfies LineSchema.Type | undefined;
});
