import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import type { ItemOutputEntrySchema } from "../schema/ItemOutputEntrySchema";
import { readItemLineEntriesFn } from "./readItemLineEntriesFn";

export namespace readItemOutputEntriesFn {
	export interface Props {
		itemId: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads line, unit-depletion, lifetime-expiry, and merge outputs owned by one canonical item. */
export const readItemOutputEntriesFn = ({ itemId, item }: readItemOutputEntriesFn.Props) => {
	const lines = readItemLineEntriesFn({
		itemId,
		item,
	});
	const entries: ItemOutputEntrySchema.Type[] = lines.flatMap(({ line, path }) =>
		line.output === undefined
			? []
			: [
					{
						output: line.output,
						path: [
							...path,
							"output",
						],
					} satisfies ItemOutputEntrySchema.Type,
				],
	);

	if (item.units?.output !== undefined) {
		entries.push({
			output: item.units.output,
			path: [
				"items",
				itemId,
				"units",
				"output",
			],
		});
	}

	if (item.clock?.onExpire !== undefined) {
		entries.push({
			output: item.clock.onExpire,
			path: [
				"items",
				itemId,
				"clock",
				"onExpire",
			],
		});
	}

	for (const [index, merge] of (item.merge ?? []).entries()) {
		if (merge.output === undefined) {
			continue;
		}

		entries.push({
			output: merge.output,
			path: [
				"items",
				itemId,
				"merge",
				index,
				"output",
			],
		});
	}

	return entries;
};
