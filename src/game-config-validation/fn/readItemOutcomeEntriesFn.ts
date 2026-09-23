import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import type { ItemOutcomeEntrySchema } from "../schema/ItemOutcomeEntrySchema";
import { readItemLineEntriesFn } from "./readItemLineEntriesFn";

export namespace readItemOutcomeEntriesFn {
	export interface Props {
		itemId: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads line, unit-depletion, lifetime-expiry, and merge outputs owned by one canonical item. */
export const readItemOutcomeEntriesFn = ({ itemId, item }: readItemOutcomeEntriesFn.Props) => {
	const lines = readItemLineEntriesFn({
		itemId,
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

	if (item.units?.outcome !== undefined) {
		entries.push({
			outcome: item.units.outcome,
			path: [
				"items",
				itemId,
				"units",
				"outcome",
			],
		});
	}

	if (item.clock?.onExpire !== undefined) {
		entries.push({
			outcome: item.clock.onExpire,
			path: [
				"items",
				itemId,
				"clock",
				"onExpire",
			],
		});
	}

	for (const [index, merge] of (item.merge ?? []).entries()) {
		if (merge.outcome === undefined) {
			continue;
		}

		entries.push({
			outcome: merge.outcome,
			path: [
				"items",
				itemId,
				"merge",
				index,
				"outcome",
			],
		});
	}

	return entries;
};
