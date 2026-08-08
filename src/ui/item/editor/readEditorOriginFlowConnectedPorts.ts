import type { EditorItemOriginEdge } from "~/bridge/item/editor/readEditorItemOriginFlow";

export type EditorOriginFlowConnectedPorts = ReadonlyMap<string, ReadonlySet<string>>;

export const readEditorOriginFlowConnectedPorts = (
	edges: ReadonlyArray<EditorItemOriginEdge>,
): EditorOriginFlowConnectedPorts => {
	const portsByNode = new Map<string, Set<string>>();
	const connect = (nodeId: string, portId: string | undefined) => {
		if (portId === undefined) return;
		const existing = portsByNode.get(nodeId);
		if (existing !== undefined) {
			existing.add(portId);
			return;
		}
		portsByNode.set(
			nodeId,
			new Set([
				portId,
			]),
		);
	};

	for (const edge of edges) {
		connect(edge.source, edge.sourcePortId);
		connect(edge.target, edge.targetPortId);
	}
	return portsByNode;
};
