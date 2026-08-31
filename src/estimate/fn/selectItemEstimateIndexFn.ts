import { Order } from "effect";

import type {
	ItemEstimateIndexEntry,
	ItemEstimateIndexRow,
} from "~/estimate/type/ItemEstimateIndex";
import type { ItemEstimateSortSchema } from "~/estimate/schema/ItemEstimateSortSchema";
import { searchEditorItemsFn } from "~/item-authoring/fn/searchEditorItemsFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

const compareRuntimeFn = (
	left: number | undefined,
	right: number | undefined,
	direction: ItemEstimateSortSchema.Type,
) => {
	if (left === undefined) return right === undefined ? 0 : 1;
	if (right === undefined) return -1;
	return direction === "fastest" ? left - right : right - left;
};

/** Applies the global Estimate query and ordering shared by UI and MCP projections. */
export const selectItemEstimateIndexFn = ({
	entries,
	incomplete,
	items,
	query,
	sort,
}: {
	readonly entries: ReadonlyArray<ItemEstimateIndexEntry>;
	readonly incomplete: boolean;
	readonly items: ReadonlyArray<ItemSchema.Type>;
	readonly query: string;
	readonly sort: ItemEstimateSortSchema.Type;
}) => {
	const estimates = new Map(
		entries.map((entry) => [
			entry.itemId,
			entry,
		]),
	);
	return searchEditorItemsFn(items, query)
		.flatMap((item): ReadonlyArray<ItemEstimateIndexRow> => {
			const estimate = estimates.get(item.id);
			return estimate === undefined || (incomplete && estimate.status === "complete")
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
				(sort === "demand"
					? right.estimate.demand - left.estimate.demand
					: compareRuntimeFn(left.estimate.runtimeMs, right.estimate.runtimeMs, sort)) ||
				Order.String(left.item.title, right.item.title),
		);
};
