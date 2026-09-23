import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";

export namespace readItemLineFn {
	export interface Props {
		readonly item: ItemSchema.Type;
		readonly lineUid: IdSchema.Type;
	}
}

/** Reads one configured product line owned by a canonical item. */
export const readItemLineFn = ({ item, lineUid }: readItemLineFn.Props) =>
	item.lines.find((line) => line.uid === lineUid) satisfies LineSchema.Type | undefined;
