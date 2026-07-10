import Fuse from "fuse.js";
import { useDeferredValue, useMemo } from "react";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";

export const useFilteredItems = (
	items: ReadonlyArray<ItemSchema.Type>,
	query: string,
): ReadonlyArray<ItemSchema.Type> => {
	const deferredQuery = useDeferredValue(query.trim());
	const fuse = useMemo(
		() =>
			new Fuse(items, {
				threshold: 0.32,
				distance: 120,
				ignoreLocation: true,
				minMatchCharLength: 2,
				keys: [
					{
						name: "title",
						weight: 3,
					},
					{
						name: "id",
						weight: 2.5,
					},
					{
						name: "description",
						weight: 1.4,
					},
					{
						name: "tags",
						weight: 1.8,
					},
					{
						name: "type",
						weight: 1.6,
					},
					{
						name: "categoryId",
						weight: 1.2,
					},
					{
						name: "scope",
						weight: 1,
					},
					{
						name: "lines.title",
						weight: 1,
					},
					{
						name: "lines.id",
						weight: 1,
					},
					{
						name: "line.title",
						weight: 1,
					},
					{
						name: "line.id",
						weight: 1,
					},
				],
			}),
		[
			items,
		],
	);

	return useMemo(
		() =>
			deferredQuery.length === 0
				? items
				: fuse.search(deferredQuery).map((result) => result.item),
		[
			deferredQuery,
			fuse,
			items,
		],
	);
};
