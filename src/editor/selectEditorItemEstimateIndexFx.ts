import { Effect } from "effect";

import type {
	EditorItemEstimateIndexEntry,
	EditorItemEstimateIndexRow,
} from "~/editor/EditorItemEstimateIndex";
import type { EditorItemEstimateSortSchema } from "~/editor/EditorItemEstimateSortSchema";
import { searchEditorItemsFx } from "~/editor/searchEditorItemsFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

const compareRuntime = (
	left: number | undefined,
	right: number | undefined,
	direction: EditorItemEstimateSortSchema.Type,
) => {
	if (left === undefined) return right === undefined ? 0 : 1;
	if (right === undefined) return -1;
	return direction === "fastest" ? left - right : right - left;
};

/** Applies the global Estimate query and ordering shared by UI and MCP projections. */
export const selectEditorItemEstimateIndexFx = Effect.fn("selectEditorItemEstimateIndexFx")(
	({
		entries,
		items,
		query,
		sort,
	}: {
		readonly entries: ReadonlyArray<EditorItemEstimateIndexEntry>;
		readonly items: ReadonlyArray<ItemSchema.Type>;
		readonly query: string;
		readonly sort: EditorItemEstimateSortSchema.Type;
	}) =>
		Effect.gen(function* () {
			const estimates = new Map(
				entries.map((entry) => [
					entry.itemId,
					entry,
				]),
			);
			return (yield* searchEditorItemsFx(items, query))
				.flatMap((item): ReadonlyArray<EditorItemEstimateIndexRow> => {
					const estimate = estimates.get(item.id);
					return estimate === undefined
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
							: compareRuntime(
									left.estimate.runtimeMs,
									right.estimate.runtimeMs,
									sort,
								)) || left.item.title.localeCompare(right.item.title),
				);
		}),
);
