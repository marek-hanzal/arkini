import type {
	EditorItemOriginFlow,
	EditorItemOriginFlowDirection,
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

/** Reads the cycle-broken branch selected by a node or connection in the active flow direction. */
export const readEditorOriginFlowHighlight = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, FlowNodePosition>,
	selection: EditorOriginFlowSelection,
	direction: EditorItemOriginFlowDirection = "outcome",
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
