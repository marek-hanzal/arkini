import { Effect } from "effect";

import type { EditorItemOriginSource } from "~/bridge/item/editor/EditorItemOriginSource";
import type { EditorItemOriginSourceIndex } from "~/bridge/item/editor/indexEditorItemOriginSourcesFx";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

export interface EditorItemOriginIncomeSubgraph {
	readonly itemIds: ReadonlySet<string>;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
}

/** Traces the one witnessed Income proof selected by reachability for a target item. */
export const readEditorItemOriginIncomeSubgraphFx = Effect.fn(
	"readEditorItemOriginIncomeSubgraphFx",
)(
	({
		acquisitionSourceByItem,
		sourcesById,
		sourcesByOutput,
		starters,
		targetItemId,
	}: Pick<EditorItemOriginSourceIndex, "sourcesById" | "sourcesByOutput" | "starters"> & {
		readonly acquisitionSourceByItem: ReadonlyMap<string, string>;
		readonly targetItemId: string;
	}) =>
		Effect.sync((): EditorItemOriginIncomeSubgraph => {
			const itemIds = new Set<string>();
			const tracedItems = new Set<string>();
			const includedSources = new Map<string, EditorItemOriginSource>();
			const traceItem = (itemId: string) => {
				itemIds.add(itemId);
				if (tracedItems.has(itemId)) return;
				tracedItems.add(itemId);
				if (starters.has(itemId)) return;
				const witnessedSourceId = acquisitionSourceByItem.get(itemId);
				const witnessedSource =
					witnessedSourceId === undefined
						? undefined
						: sourcesById.get(witnessedSourceId);
				const directSources = [
					...(sourcesByOutput.get(itemId) ?? []),
				].sort((left, right) => left.id.localeCompare(right.id));
				const source = witnessedSource ?? directSources[0];
				if (source === undefined) return;
				includedSources.set(source.id, source);
				for (const requirementItemId of unique(source.requirementItemIds).sort(
					(left, right) => left.localeCompare(right),
				))
					traceItem(requirementItemId);
			};
			traceItem(targetItemId);
			return {
				itemIds,
				sources: [
					...includedSources.values(),
				],
			};
		}),
);
