import Fuse from "fuse.js";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const normalizeExactTerm = (value: string) => value.trim().toLowerCase();

/** Applies the editor's canonical exact-first Fuse search while preserving input order. */
export const searchEditorItemsFn = (
	items: ReadonlyArray<ItemSchema.Type>,
	query: string,
): ReadonlyArray<ItemSchema.Type> => {
	const documents = items.map((item, order) => ({
		item,
		order,
		terms: [
			item.id,
			item.title,
			item.description,
			item.type,
		],
	}));
	const normalizedQuery = query.trim();
	if (normalizedQuery === "") return items;
	const exactQuery = normalizeExactTerm(normalizedQuery);
	const exact = documents.filter(({ terms }) =>
		terms.some((term) => normalizeExactTerm(term) === exactQuery),
	);
	if (exact.length > 0) return exact.map(({ item }) => item);
	return new Fuse(documents, {
		keys: [
			"terms",
		],
		threshold: 0.28,
		ignoreLocation: true,
		includeScore: true,
	})
		.search(normalizedQuery)
		.sort(
			(first, second) =>
				(first.score ?? 1) - (second.score ?? 1) || first.item.order - second.item.order,
		)
		.map(({ item }) => item.item);
};
