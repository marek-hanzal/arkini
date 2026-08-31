import type { ItemOriginEdge } from "~/flow/type/ItemOriginFlow";

export type ConnectedPorts = ReadonlyMap<string, ReadonlySet<string>>;

const connectPortFn = (
	portsByNode: Map<string, Set<string>>,
	nodeId: string,
	portId: string | undefined,
) => {
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

/** Reads the exact connected port IDs for every rendered item node. */
export const readConnectedPortsFn = (edges: ReadonlyArray<ItemOriginEdge>): ConnectedPorts => {
	const portsByNode = new Map<string, Set<string>>();
	for (const edge of edges) {
		connectPortFn(portsByNode, edge.source, edge.sourcePortId);
		connectPortFn(portsByNode, edge.target, edge.targetPortId);
	}
	return portsByNode;
};
