import { Order } from "effect";

import type {
	ItemEstimateIndexEntry,
	ItemEstimateIndexRow,
} from "~/estimate/type/ItemEstimateIndex";
import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { searchFn } from "~/item-authoring/fn/searchFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";

const compareRuntimeFn = (
	left: number | undefined,
	right: number | undefined,
	direction: Exclude<ItemEstimateViewSchema.Type, "incomplete">,
) => {
	if (left === undefined) return right === undefined ? 0 : 1;
	if (right === undefined) return -1;
	return direction === "fastest" ? left - right : right - left;
};

/** Applies the global Estimate query and ordering shared by UI and MCP projections. */
export const selectItemEstimateIndexFn = ({
	entries,
	itemType,
	items,
	query,
	view,
}: {
	readonly entries: ReadonlyArray<ItemEstimateIndexEntry>;
	readonly itemType?: TypeSchema.Type;
	readonly items: ReadonlyArray<ItemSchema.Type>;
	readonly query: string;
	readonly view: ItemEstimateViewSchema.Type;
}) => {
	const estimates = new Map(
		entries.map((entry) => [
			entry.itemId,
			entry,
		]),
	);
	return searchFn(
		items.filter((item) => itemType === undefined || item.type === itemType),
		query,
	)
		.flatMap((item): ReadonlyArray<ItemEstimateIndexRow> => {
			const estimate = estimates.get(item.id);
			return estimate === undefined ||
				(view === "incomplete" && estimate.status === "complete")
				? []
				: [
						{
							estimate,
							item,
						},
					];
		})
		.sort(
			(left, right) =>
				(view === "incomplete"
					? 0
					: view === "demand"
						? right.estimate.demand - left.estimate.demand
						: compareRuntimeFn(
								left.estimate.runtimeMs,
								right.estimate.runtimeMs,
								view,
							)) || Order.String(left.item.title, right.item.title),
		);
};
