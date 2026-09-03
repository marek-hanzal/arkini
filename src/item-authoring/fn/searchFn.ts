import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { createFuzzySearchFn } from "~/fuzzy-search/fn/createFuzzySearchFn";

/** Applies the editor's canonical exact-first Fuse search while preserving input order. */
export const searchFn = (
	items: ReadonlyArray<ItemSchema.Type>,
	query: string,
): ReadonlyArray<ItemSchema.Type> => {
	const fuzzyFn = createFuzzySearchFn({
		candidates: items.map((item) => ({
			terms: [
				item.id,
				item.title,
				item.description,
				item.type,
			],
			value: item,
		})),
	});
	return fuzzyFn(query);
};
