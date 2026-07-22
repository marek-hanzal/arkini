import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

import type { ItemOutputEntrySchema } from "../schema/ItemOutputEntrySchema";
import { readItemLineEntriesFx } from "./readItemLineEntriesFx";

export namespace readItemOutputEntriesFx {
	export interface Props {
		itemId: IdSchema.Type;
		item: ItemSchema.Type;
	}
}

/** Reads line, charge-depletion, temporary, and merge outputs owned by one canonical item. */
export const readItemOutputEntriesFx = Effect.fn("readItemOutputEntriesFx")(function* ({
	itemId,
	item,
}: readItemOutputEntriesFx.Props) {
	const lines = yield* readItemLineEntriesFx({
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

	if (item.charges?.output !== undefined) {
		entries.push({
			output: item.charges.output,
			path: [
				"items",
				itemId,
				"charges",
				"output",
			],
		});
	}

	if (item.type === ItemEnumSchema.enum.Temporary && item.output !== undefined) {
		entries.push({
			output: item.output,
			path: [
				"items",
				itemId,
				"output",
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
});
