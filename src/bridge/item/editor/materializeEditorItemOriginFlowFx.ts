import { Effect } from "effect";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginEdge,
	type EditorItemOriginFlow,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperation,
} from "~/bridge/item/editor/EditorItemOriginFlow";
import type { EditorItemOriginSourceIndex } from "~/bridge/item/editor/indexEditorItemOriginSourcesFx";
import type {
	EditorItemOriginIncomeSubgraph,
	EditorItemOriginSource,
} from "~/editor/EditorItemOriginSource";
import { readEditorItemOriginRelationsFx } from "~/editor/readEditorItemOriginRelationsFx";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const readOperationPortLabel = (itemId: string, items: EditorItemOriginSourceIndex["items"]) =>
	items.get(itemId)?.title || itemId;

const readOperation = (
	source: EditorItemOriginSource,
	items: EditorItemOriginSourceIndex["items"],
): EditorItemOriginOperation => ({
	id: source.id,
	inputs: unique(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => left.localeCompare(right))
		.map((itemId) => ({
			id: `${source.id}:input:${itemId}`,
			itemId,
			label: readOperationPortLabel(itemId, items),
		})),
	kind: source.kind,
	label: source.label,
	outputs: source.outputs.map((output, index) => ({
		id: `${source.id}:output:${index}:${output.itemId}`,
		itemId: output.itemId,
		label: readOperationPortLabel(output.itemId, items),
	})),
});

const readItemNode = (
	itemId: string,
	index: EditorItemOriginSourceIndex,
	acquisitionSourceByItem: ReadonlyMap<string, string>,
	includedSourceIds?: ReadonlySet<string>,
): EditorItemOriginItemNode => {
	const item = index.items.get(itemId);
	const operations = [
		...(index.sourcesByOwner.get(itemId) ?? []),
	]
		.filter((source) => includedSourceIds === undefined || includedSourceIds.has(source.id))
		.sort((left, right) => left.id.localeCompare(right.id))
		.map((source) => readOperation(source, index.items));
	return {
		acquisitionSourceId: acquisitionSourceByItem.get(itemId),
		id: `item:${itemId}`,
		itemId,
		operations,
		resourceIds: item?.asset.default ?? [
			"missing",
		],
		starterScopes: [
			...(index.starters.get(itemId) ?? []),
		],
		title: item?.title || itemId,
		type: item?.type ?? "missing",
	};
};

const readEdgesFx = Effect.fn("materializeEditorItemOriginFlowFx.readEdgesFx")(function* (
	sources: ReadonlyArray<EditorItemOriginSource>,
	itemsInGraph?: ReadonlySet<string>,
): Effect.fn.Return<EditorItemOriginEdge[]> {
	const edges: EditorItemOriginEdge[] = [];
	for (const source of sources) {
		if (itemsInGraph !== undefined && !itemsInGraph.has(source.ownerItemId)) continue;
		for (const relation of yield* readEditorItemOriginRelationsFx(source)) {
			if (
				itemsInGraph !== undefined &&
				(!itemsInGraph.has(relation.fromItemId) || !itemsInGraph.has(relation.toItemId))
			)
				continue;
			if (relation.role === "input") {
				const targetPortId = `${source.id}:input:${relation.fromItemId}`;
				edges.push({
					id: targetPortId,
					operationId: source.id,
					role: "input",
					source: `item:${relation.fromItemId}`,
					sourcePortId: EditorItemOriginItemOutputPortId,
					target: `item:${relation.toItemId}`,
					targetPortId,
				});
				continue;
			}
			const outputIndex = relation.outputIndex;
			if (outputIndex === undefined) continue;
			const sourcePortId = `${source.id}:output:${outputIndex}:${relation.toItemId}`;
			edges.push({
				id: sourcePortId,
				operationId: source.id,
				role: "output",
				source: `item:${relation.fromItemId}`,
				sourcePortId,
				target: `item:${relation.toItemId}`,
				targetPortId: EditorItemOriginItemInputPortId,
			});
		}
	}
	return edges;
});

/** Materializes indexed acquisition truth into the editor's public node-and-edge contract. */
export const materializeEditorItemOriginFlowFx = Effect.fn("materializeEditorItemOriginFlowFx")(
	({
		acquisitionSourceByItem,
		index,
		originSubgraph,
	}: {
		readonly acquisitionSourceByItem: ReadonlyMap<string, string>;
		readonly index: EditorItemOriginSourceIndex;
		readonly originSubgraph?: EditorItemOriginIncomeSubgraph;
	}) =>
		Effect.gen(function* (): Effect.fn.Return<EditorItemOriginFlow> {
			if (originSubgraph === undefined)
				return {
					edges: yield* readEdgesFx(index.sources),
					nodes: [
						...index.items.keys(),
					].map((itemId) => readItemNode(itemId, index, acquisitionSourceByItem)),
				};
			const sourceIds = new Set(originSubgraph.sources.map(({ id }) => id));
			return {
				edges: yield* readEdgesFx(originSubgraph.sources, originSubgraph.itemIds),
				nodes: [
					...originSubgraph.itemIds,
				].map((itemId) => readItemNode(itemId, index, acquisitionSourceByItem, sourceIds)),
			};
		}),
);
