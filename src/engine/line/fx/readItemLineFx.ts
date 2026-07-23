import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

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
				type: ItemEnumSchema.enum.Producer,
			},
			({ lines }) => lines.find((line) => line.id === lineId),
		)
		.with(
			{
				type: P.union(
					ItemEnumSchema.enum.Blueprint,
					ItemEnumSchema.enum.Craft,
					ItemEnumSchema.enum.Stash,
				),
			},
			({ line }) => (line.id === lineId ? line : undefined),
		)
		.otherwise(() => undefined) satisfies LineSchema.Type | undefined;
});
