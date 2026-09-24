import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { searchFn } from "~/item-authoring/fn/searchFn";

export namespace selectItemCollectionFn {
	export type View = "name" | "with-note";
}

/** Applies authored catalog filters without mutating the saved item registry. */
export const selectItemCollectionFn = ({
	items,
	notedItemUids,
	query,
	view,
}: {
	readonly items: ReadonlyArray<ItemSchema.Type>;
	readonly notedItemUids: ReadonlySet<string>;
	readonly query: string;
	readonly view: selectItemCollectionFn.View;
}): ReadonlyArray<ItemSchema.Type> =>
	searchFn(
		items
			.filter((item) => view !== "with-note" || notedItemUids.has(item.uid))
			.sort((left, right) => left.title.localeCompare(right.title)),
		query,
	);
