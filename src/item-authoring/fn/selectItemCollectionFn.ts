import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { filterFn } from "~/item-authoring/fn/filterFn";

export namespace selectItemCollectionFn {
	export type View = "name" | "with-note";
}

/** Applies authored catalog filters without mutating the saved item registry. */
export const selectItemCollectionFn = ({
	items,
	notedItemUids,
	draft,
	query,
	view,
}: {
	readonly items: ReadonlyArray<ItemSchema.Type>;
	readonly notedItemUids: ReadonlySet<string>;
	readonly draft: boolean;
	readonly query: string;
	readonly view: selectItemCollectionFn.View;
}): ReadonlyArray<ItemSchema.Type> =>
	filterFn(
		items
			.filter((item) => view !== "with-note" || notedItemUids.has(item.uid))
			.sort((left, right) => left.title.localeCompare(right.title)),
		{
			draft,
			query,
		},
	);
