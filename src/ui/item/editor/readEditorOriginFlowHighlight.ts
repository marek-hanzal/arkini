import type {
	EditorItemOriginEdge,
	EditorItemOriginFlow,
	EditorItemOriginFlowDirection,
	EditorItemOriginItemNode,
	EditorItemOriginNode,
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

/**
 * Reads one concrete acquisition proof from the complete graph. The bridge chooses the canonical
 * acquisition source for reachable items; the UI only follows that witness and keeps every
 * mandatory requirement attached to it.
 */
const readIncomeProofHighlight = (
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
	const outputEdgesByItem = new Map<string, EditorItemOriginEdge[]>();
	const requirementEdgesBySource = new Map<string, EditorItemOriginEdge[]>();
	for (const edge of flow.edges) {
		if (edge.role === "output") {
			const edges = outputEdgesByItem.get(edge.target) ?? [];
			edges.push(edge);
			outputEdgesByItem.set(edge.target, edges);
		} else {
			const edges = requirementEdgesBySource.get(edge.target) ?? [];
			edges.push(edge);
			requirementEdgesBySource.set(edge.target, edges);
		}
	}

	const nodeIds = new Set<string>();
	const edgeIds = new Set<string>();
	const tracedItems = new Set<string>();
	const traceItem = (itemNode: EditorItemOriginItemNode, activeItemIds: ReadonlySet<string>) => {
		nodeIds.add(itemNode.id);
		if (itemNode.starterScopes.length > 0 || activeItemIds.has(itemNode.id)) return;
		if (tracedItems.has(itemNode.id)) return;
		tracedItems.add(itemNode.id);

		const directOutputEdges = [
			...(outputEdgesByItem.get(itemNode.id) ?? []),
		].sort((left, right) => left.source.localeCompare(right.source));
		const outputEdge =
			itemNode.acquisitionSourceId === undefined
				? directOutputEdges[0]
				: directOutputEdges.find(({ source }) => source === itemNode.acquisitionSourceId);
		if (outputEdge === undefined) return;
		const sourceNode = nodeById.get(outputEdge.source);
		if (sourceNode?.kind !== "source") return;

		edgeIds.add(outputEdge.id);
		nodeIds.add(sourceNode.id);
		const nextActive = new Set(activeItemIds);
		nextActive.add(itemNode.id);
		for (const edge of [
			...(requirementEdgesBySource.get(sourceNode.id) ?? []),
		].sort(
			(left, right) =>
				(left.role === "owner" ? -1 : 0) - (right.role === "owner" ? -1 : 0) ||
				left.source.localeCompare(right.source),
		)) {
			edgeIds.add(edge.id);
			const requirementNode = nodeById.get(edge.source);
			if (requirementNode?.kind !== "item") {
				if (requirementNode !== undefined) nodeIds.add(requirementNode.id);
				continue;
			}
			traceItem(requirementNode, nextActive);
		}
	};
	traceItem(startNode, new Set());
	return {
		edgeIds,
		nodeIds,
	};
};

const readDirectionalHighlight = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, FlowNodePosition>,
	selection: EditorOriginFlowSelection,
	direction: EditorItemOriginFlowDirection,
): EditorOriginFlowHighlight => {
	const edgesBySource = new Map<string, Array<EditorItemOriginFlow["edges"][number]>>();
	for (const edge of flow.edges) {
		const traversalSourceId = direction === "income" ? edge.target : edge.source;
		const traversalTargetId = direction === "income" ? edge.source : edge.target;
		const source = positions.get(traversalSourceId);
		const target = positions.get(traversalTargetId);
		if (source === undefined || target === undefined) continue;
		const movesForward =
			direction === "income"
				? target.flowOrder < source.flowOrder
				: target.flowOrder > source.flowOrder;
		if (!movesForward) continue;
		const traversedEdge =
			direction === "income"
				? {
						...edge,
						source: traversalSourceId,
						target: traversalTargetId,
					}
				: edge;
		const outgoing = edgesBySource.get(traversalSourceId);
		if (outgoing === undefined)
			edgesBySource.set(traversalSourceId, [
				traversedEdge,
			]);
		else outgoing.push(traversedEdge);
	}

	const nodeIds = new Set<string>();
	const edgeIds = new Set<string>();
	const pendingNodeIds: string[] = [];
	if (selection.kind === "node") {
		if (!flow.nodes.some(({ id }) => id === selection.id))
			return {
				edgeIds,
				nodeIds,
			};
		nodeIds.add(selection.id);
		pendingNodeIds.push(selection.id);
	} else {
		const selectedEdge = flow.edges.find(({ id }) => id === selection.id);
		if (selectedEdge === undefined)
			return {
				edgeIds,
				nodeIds,
			};
		edgeIds.add(selectedEdge.id);
		nodeIds.add(selectedEdge.source);
		nodeIds.add(selectedEdge.target);
		pendingNodeIds.push(direction === "income" ? selectedEdge.source : selectedEdge.target);
	}

	while (pendingNodeIds.length > 0) {
		const source = pendingNodeIds.pop();
		if (source === undefined) continue;
		for (const edge of edgesBySource.get(source) ?? []) {
			edgeIds.add(edge.id);
			if (nodeIds.has(edge.target)) continue;
			nodeIds.add(edge.target);
			pendingNodeIds.push(edge.target);
		}
	}

	return {
		edgeIds,
		nodeIds,
	};
};

/** Reads the active branch selected by a node or connection in the chosen flow direction. */
export const readEditorOriginFlowHighlight = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, FlowNodePosition>,
	selection: EditorOriginFlowSelection,
	direction: EditorItemOriginFlowDirection = "outcome",
): EditorOriginFlowHighlight => {
	if (direction === "income" && selection.kind === "node") {
		const selectedNode: EditorItemOriginNode | undefined = flow.nodes.find(
			({ id }) => id === selection.id,
		);
		if (selectedNode?.kind === "item") return readIncomeProofHighlight(flow, selectedNode);
	}
	return readDirectionalHighlight(flow, positions, selection, direction);
};
