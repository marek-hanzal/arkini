import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";

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
	readonly x: number;
}

/** Reads the visually forward branch selected by a node or connection. */
export const readEditorOriginFlowHighlight = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, FlowNodePosition>,
	selection: EditorOriginFlowSelection,
): EditorOriginFlowHighlight => {
	const edgesBySource = new Map<string, Array<EditorItemOriginFlow["edges"][number]>>();
	for (const edge of flow.edges) {
		const source = positions.get(edge.source);
		const target = positions.get(edge.target);
		if (source === undefined || target === undefined || target.x <= source.x) continue;
		const outgoing = edgesBySource.get(edge.source);
		if (outgoing === undefined)
			edgesBySource.set(edge.source, [
				edge,
			]);
		else outgoing.push(edge);
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
		pendingNodeIds.push(selectedEdge.target);
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
