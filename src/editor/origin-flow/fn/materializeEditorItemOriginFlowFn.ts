import { Order } from "effect";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginEdge,
	type EditorItemOriginFlow,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperation,
	type EditorItemOriginOperationRequirementContext,
} from "~/editor/origin-flow/EditorItemOriginFlow";
import type { EditorItemOriginSourceIndex } from "~/editor/origin-flow/fx/indexEditorItemOriginSourcesFx";
import type { EditorItemOriginSource } from "~/editor/EditorItemOriginSource";
import { readEditorItemOriginRelationsFn } from "~/editor/origin-flow/fn/readEditorItemOriginRelationsFn";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const readOperationPortLabel = (itemId: string, items: EditorItemOriginSourceIndex["items"]) =>
	items.get(itemId)?.title || itemId;

const readRequirementContexts = (
	source: EditorItemOriginSource,
	itemId: string,
): ReadonlyArray<EditorItemOriginOperationRequirementContext> =>
	source.outputs.flatMap((output) => [
		...output.requirements.allOf
			.filter((requirement) => requirement.itemId === itemId)
			.map((requirement) => ({
				clause: "all-of" as const,
				outputRouteId: output.routeId,
				requirement,
			})),
		...output.requirements.anyOf.flatMap((clause, clauseIndex) =>
			clause
				.filter((requirement) => requirement.itemId === itemId)
				.map((requirement) => ({
					clause: "any-of" as const,
					clauseIndex,
					outputRouteId: output.routeId,
					requirement,
				})),
		),
		...(output.requirements.unsupported ?? [])
			.filter((requirement) => requirement.itemId === itemId)
			.map((requirement) => ({
				clause: "unsupported" as const,
				outputRouteId: output.routeId,
				requirement,
			})),
	]);

const readOperation = (
	source: EditorItemOriginSource,
	items: EditorItemOriginSourceIndex["items"],
): EditorItemOriginOperation => ({
	id: source.id,
	inputs: unique(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => Order.String(left, right))
		.map((itemId) => ({
			id: `${source.id}:input:${itemId}`,
			itemId,
			label: readOperationPortLabel(itemId, items),
			requirementContexts: readRequirementContexts(source, itemId),
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
): EditorItemOriginItemNode => {
	const item = index.items.get(itemId);
	const operations = [
		...(index.sourcesByOwner.get(itemId) ?? []),
	]
		.sort((left, right) => Order.String(left.id, right.id))
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

const readEdgesFn = (sources: ReadonlyArray<EditorItemOriginSource>): EditorItemOriginEdge[] => {
	const edges: EditorItemOriginEdge[] = [];
	for (const source of sources) {
		for (const relation of readEditorItemOriginRelationsFn(source)) {
			if (relation.role === "input") {
				const targetPortId = `${source.id}:input:${relation.fromItemId}`;
				edges.push({
					id: targetPortId,
					operationId: source.id,
					role: "input",
					requirementContexts: readRequirementContexts(source, relation.fromItemId),
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
};

/** Materializes indexed acquisition truth into the editor's public node-and-edge contract. */
export const materializeEditorItemOriginFlowFn = ({
	acquisitionSourceByItem,
	index,
}: {
	readonly acquisitionSourceByItem: ReadonlyMap<string, string>;
	readonly index: EditorItemOriginSourceIndex;
}): EditorItemOriginFlow => ({
	edges: readEdgesFn(index.sources),
	nodes: [
		...index.items.keys(),
	].map((itemId) => readItemNode(itemId, index, acquisitionSourceByItem)),
});
