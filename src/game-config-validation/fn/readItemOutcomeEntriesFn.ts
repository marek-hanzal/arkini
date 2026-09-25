import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import type { ItemOutcomeEntrySchema } from "../schema/ItemOutcomeEntrySchema";
import { readItemLineEntriesFn } from "./readItemLineEntriesFn";

export namespace readItemOutcomeEntriesFn {
	export interface Props {
		itemUid: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads line and merge outputs owned by one canonical item. */
export const readItemOutcomeEntriesFn = ({ itemUid, item }: readItemOutcomeEntriesFn.Props) => {
	const lines = readItemLineEntriesFn({
		itemUid,
		item,
	});
	const entries: ItemOutcomeEntrySchema.Type[] = lines.flatMap(({ line, path }) =>
		line.outcome === undefined
			? []
			: [
					{
						outcome: line.outcome,
						path: [
							...path,
							"outcome",
						],
					} satisfies ItemOutcomeEntrySchema.Type,
				],
	);

	for (const [index, merge] of (item.merge ?? []).entries()) {
		if (merge.outcome === undefined) {
			continue;
		}

		entries.push({
			outcome: merge.outcome,
			path: [
				"items",
				itemUid,
				"merge",
				index,
				"outcome",
			],
		});
	}

	return entries;
};
