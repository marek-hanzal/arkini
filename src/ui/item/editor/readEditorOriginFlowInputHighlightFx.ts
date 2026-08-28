import { Effect } from "effect";

import type {
	EditorItemOriginEdge,
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
} from "~/bridge/item/editor/EditorItemOriginFlow";
import {
	EditorOriginFlowEdgeOrder,
	type EditorOriginFlowHighlight,
} from "~/ui/item/editor/EditorOriginFlowHighlight";

/** Reads every operation that depends on the selected item and recursively follows its outputs. */
export const readEditorOriginFlowInputHighlightFx = Effect.fn(
	"readEditorOriginFlowInputHighlightFx",
)((flow: EditorItemOriginFlow, startNode: EditorItemOriginItemNode) =>
	Effect.sync((): EditorOriginFlowHighlight => {
		const nodeById = new Map(
			flow.nodes.map(
				(node) =>
					[
						node.id,
						node,
					] as const,
			),
		);
		const inputEdgesBySource = new Map<string, EditorItemOriginEdge[]>();
		const outputEdgesByOperation = new Map<string, EditorItemOriginEdge[]>();
		const ownerNodeIdByOperation = new Map<string, string>();
		const operationIdsByOwner = new Map<string, Set<string>>();
		for (const edge of flow.edges) {
			const ownerNodeId = edge.role === "output" ? edge.source : edge.target;
			ownerNodeIdByOperation.set(edge.operationId, ownerNodeId);
			const ownerOperations = operationIdsByOwner.get(ownerNodeId) ?? new Set<string>();
			ownerOperations.add(edge.operationId);
			operationIdsByOwner.set(ownerNodeId, ownerOperations);
			if (edge.role === "input") {
				const edges = inputEdgesBySource.get(edge.source) ?? [];
				edges.push(edge);
				inputEdgesBySource.set(edge.source, edges);
			} else {
				const edges = outputEdgesByOperation.get(edge.operationId) ?? [];
				edges.push(edge);
				outputEdgesByOperation.set(edge.operationId, edges);
			}
		}

		const nodeIds = new Set<string>([
			startNode.id,
		]);
		const edgeIds = new Set<string>();
		const tracedItems = new Set<string>();
		const tracedOperations = new Set<string>();
		const markEdge = (edge: EditorItemOriginEdge) => {
			edgeIds.add(edge.id);
			nodeIds.add(edge.source);
			nodeIds.add(edge.target);
		};

		const traceOperation = (operationId: string) => {
			if (tracedOperations.has(operationId)) return;
			tracedOperations.add(operationId);
			const ownerNodeId = ownerNodeIdByOperation.get(operationId);
			if (ownerNodeId !== undefined) nodeIds.add(ownerNodeId);
			for (const edge of [
				...(outputEdgesByOperation.get(operationId) ?? []),
			].sort(EditorOriginFlowEdgeOrder)) {
				markEdge(edge);
				const outputNode = nodeById.get(edge.target);
				if (outputNode !== undefined) traceItem(outputNode);
			}
		};
		const traceItem = (itemNode: EditorItemOriginItemNode) => {
			nodeIds.add(itemNode.id);
			if (tracedItems.has(itemNode.id)) return;
			tracedItems.add(itemNode.id);

			const operationIds = new Set(operationIdsByOwner.get(itemNode.id) ?? []);
			for (const edge of [
				...(inputEdgesBySource.get(itemNode.id) ?? []),
			].sort(EditorOriginFlowEdgeOrder)) {
				markEdge(edge);
				operationIds.add(edge.operationId);
			}
			for (const operationId of [
				...operationIds,
			].sort((left, right) => left.localeCompare(right)))
				traceOperation(operationId);
		};

		traceItem(startNode);
		return {
			edgeIds,
			edgeLevels: new Map(),
			nodeIds,
			nodeLevels: new Map(),
		};
	}),
);
