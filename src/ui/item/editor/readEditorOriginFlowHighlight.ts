import type {
	EditorItemOriginEdge,
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
} from "~/bridge/item/editor/readEditorItemOriginFlow";

export type EditorOriginFlowSelection =
	| {
			readonly id: string;
			readonly kind: "edge";
	  }
	| {
			readonly id: string;
			readonly kind: "node";
	  };

export interface EditorOriginFlowHighlight {
	readonly edgeIds: ReadonlySet<string>;
	readonly nodeIds: ReadonlySet<string>;
}

interface FlowNodePosition {
	readonly flowOrder: number;
}

/** Reads the complete Income ancestry through operations embedded in their owning item nodes. */
const readIncomeHighlight = (
	flow: EditorItemOriginFlow,
	startNode: EditorItemOriginItemNode,
): EditorOriginFlowHighlight => {
	const nodeById = new Map(
		flow.nodes.map(
			(node) =>
				[
					node.id,
					node,
				] as const,
		),
	);
	const outputEdgesByTarget = new Map<string, EditorItemOriginEdge[]>();
	const inputEdgesByOperation = new Map<string, EditorItemOriginEdge[]>();
	for (const edge of flow.edges) {
		if (edge.role === "output") {
			const edges = outputEdgesByTarget.get(edge.target) ?? [];
			edges.push(edge);
			outputEdgesByTarget.set(edge.target, edges);
		} else {
			const edges = inputEdgesByOperation.get(edge.operationId) ?? [];
			edges.push(edge);
			inputEdgesByOperation.set(edge.operationId, edges);
		}
	}

	const nodeIds = new Set<string>();
	const edgeIds = new Set<string>();
	const tracedItems = new Set<string>();
	const tracedOperations = new Set<string>();
	const traceItem = (itemNode: EditorItemOriginItemNode) => {
		nodeIds.add(itemNode.id);
		if (itemNode.starterScopes.length > 0 || tracedItems.has(itemNode.id)) return;
		tracedItems.add(itemNode.id);

		const directOutputEdges = [
			...(outputEdgesByTarget.get(itemNode.id) ?? []),
		].sort(
			(left, right) =>
				left.operationId.localeCompare(right.operationId) ||
				left.id.localeCompare(right.id),
		);
		for (const outputEdge of directOutputEdges) {
			edgeIds.add(outputEdge.id);
			if (tracedOperations.has(outputEdge.operationId)) continue;
			tracedOperations.add(outputEdge.operationId);

			const ownerNode = nodeById.get(outputEdge.source);
			if (ownerNode !== undefined) traceItem(ownerNode);
			for (const edge of [
				...(inputEdgesByOperation.get(outputEdge.operationId) ?? []),
			].sort(
				(left, right) =>
					left.source.localeCompare(right.source) || left.id.localeCompare(right.id),
			)) {
				edgeIds.add(edge.id);
				const requirementNode = nodeById.get(edge.source);
				if (requirementNode !== undefined) traceItem(requirementNode);
			}
		}
	};
	traceItem(startNode);
	return {
		edgeIds,
		nodeIds,
	};
};

/** Reads the complete Income ancestry selected by an item or connection. */
export const readEditorOriginFlowHighlight = (
	flow: EditorItemOriginFlow,
	_positions: ReadonlyMap<string, FlowNodePosition>,
	selection: EditorOriginFlowSelection,
): EditorOriginFlowHighlight => {
	if (selection.kind === "node") {
		const selectedNode = flow.nodes.find(({ id }) => id === selection.id);
		return selectedNode === undefined
			? {
					edgeIds: new Set(),
					nodeIds: new Set(),
				}
			: readIncomeHighlight(flow, selectedNode);
	}

	const selectedEdge = flow.edges.find(({ id }) => id === selection.id);
	if (selectedEdge === undefined)
		return {
			edgeIds: new Set(),
			nodeIds: new Set(),
		};
	const startNode = flow.nodes.find(({ id }) => id === selectedEdge.source);
	if (startNode === undefined)
		return {
			edgeIds: new Set([
				selectedEdge.id,
			]),
			nodeIds: new Set([
				selectedEdge.source,
				selectedEdge.target,
			]),
		};
	const highlight = readIncomeHighlight(flow, startNode);
	return {
		edgeIds: new Set([
			selectedEdge.id,
			...highlight.edgeIds,
		]),
		nodeIds: new Set([
			selectedEdge.target,
			...highlight.nodeIds,
		]),
	};
};
