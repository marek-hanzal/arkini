import { Order } from "effect";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ItemEstimateIndexRow } from "~/estimate/type/ItemEstimateIndex";
import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { filterFn } from "~/item-authoring/fn/filterFn";

export namespace selectItemCollectionFn {
	export type View = "name" | "with-note" | ItemEstimateViewSchema.Type;
}

/** Combines item search and drafts with the canonical Estimate ordering, retaining unestimated items. */
export const selectItemCollectionFn = ({
	items,
	orderedEstimates,
	notedItemUids,
	draft,
	query,
	view,
}: {
	readonly items: ReadonlyArray<ItemSchema.Type>;
	readonly orderedEstimates: ReadonlyArray<ItemEstimateIndexRow>;
	readonly notedItemUids: ReadonlySet<string>;
	readonly draft: boolean;
	readonly query: string;
	readonly view: selectItemCollectionFn.View;
}): ReadonlyArray<ItemSchema.Type> => {
	if (view === "name" || view === "with-note")
		return filterFn(
			[
				...items.filter((item) => view !== "with-note" || notedItemUids.has(item.uid)),
			].sort((left, right) => left.title.localeCompare(right.title)),
			{
				draft,
				query,
			},
		);
	const ranks = new Map(
		orderedEstimates.map(({ item }, index) => [
			item.uid,
			index,
		]),
	);
	const incomplete = new Set(
		orderedEstimates
			.filter(({ estimate }) => estimate.status !== "complete")
			.map(({ item }) => item.uid),
	);
	return filterFn(items, {
		draft,
		query,
	})
		.filter((item) => view !== "incomplete" || incomplete.has(item.uid))
		.sort(
			(left, right) =>
				(view === "incomplete"
					? 0
					: (ranks.get(left.uid) ?? Number.MAX_SAFE_INTEGER) -
						(ranks.get(right.uid) ?? Number.MAX_SAFE_INTEGER)) ||
				Order.String(left.title, right.title),
		);
};
