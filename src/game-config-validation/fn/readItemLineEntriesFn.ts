import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import type { ItemLineEntrySchema } from "../schema/ItemLineEntrySchema";

export namespace readItemLineEntriesFn {
	export interface Props {
		itemUid: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads every product line owned by one canonical item with stable authoring paths. */
export const readItemLineEntriesFn = ({ itemUid, item }: readItemLineEntriesFn.Props) =>
	item.lines.map(
		(line, index) =>
			({
				line,
				path: [
					"items",
					itemUid,
					"lines",
					index,
				],
			}) satisfies ItemLineEntrySchema.Type,
	);
