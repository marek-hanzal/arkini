import type {
	EditorItemOriginFlow,
	EditorItemOriginFlowDirection,
} from "~/bridge/item/editor/readEditorItemOriginFlow";

interface FlowNavigationPosition {
	readonly flowOrder: number;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

const readCenter = (position: FlowNavigationPosition) => ({
	x: position.x + position.width / 2,
	y: position.y + position.height / 2,
});

const readDistance = (left: FlowNavigationPosition, right: FlowNavigationPosition) => {
	const leftCenter = readCenter(left);
	const rightCenter = readCenter(right);
	return Math.hypot(rightCenter.x - leftCenter.x, rightCenter.y - leftCenter.y);
};

const readTurnCost = (
	previous: FlowNavigationPosition | undefined,
	current: FlowNavigationPosition,
	target: FlowNavigationPosition,
) => {
	if (previous === undefined) return 0;
	const previousCenter = readCenter(previous);
	const currentCenter = readCenter(current);
	const targetCenter = readCenter(target);
	const incomingX = currentCenter.x - previousCenter.x;
	const incomingY = currentCenter.y - previousCenter.y;
	const outgoingX = targetCenter.x - currentCenter.x;
	const outgoingY = targetCenter.y - currentCenter.y;
	const incomingLength = Math.hypot(incomingX, incomingY);
	const outgoingLength = Math.hypot(outgoingX, outgoingY);
	if (incomingLength === 0 || outgoingLength === 0) return 0;
	const cosine =
		(incomingX * outgoingX + incomingY * outgoingY) / (incomingLength * outgoingLength);
	return 1 - Math.max(-1, Math.min(1, cosine));
};

/** Reads one stable depth-first walk, preferring the visually straightest branch in the active flow direction. */
export const readEditorOriginFlowNavigation = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, FlowNavigationPosition>,
	startNodeId: string,
	direction: EditorItemOriginFlowDirection = "outcome",
	allowedEdgeIds?: ReadonlySet<string>,
): ReadonlyArray<string> => {
	if (!flow.nodes.some(({ id }) => id === startNodeId) || !positions.has(startNodeId)) return [];

	const targetsBySource = new Map<string, Set<string>>();
	for (const edge of flow.edges) {
		if (allowedEdgeIds !== undefined && !allowedEdgeIds.has(edge.id)) continue;
		const sourceId = direction === "income" ? edge.target : edge.source;
		const targetId = direction === "income" ? edge.source : edge.target;
		const source = positions.get(sourceId);
		const target = positions.get(targetId);
		if (source === undefined || target === undefined) continue;
		const movesForward =
			allowedEdgeIds !== undefined ||
			(direction === "income"
				? target.flowOrder < source.flowOrder
				: target.flowOrder > source.flowOrder);
		if (!movesForward) continue;
		const targets = targetsBySource.get(sourceId) ?? new Set<string>();
		targets.add(targetId);
		targetsBySource.set(sourceId, targets);
	}

	const visited = new Set<string>();
	const ordered: string[] = [];
	const visit = (nodeId: string, previousNodeId?: string) => {
		if (visited.has(nodeId)) return;
		const current = positions.get(nodeId);
		if (current === undefined) return;
		visited.add(nodeId);
		ordered.push(nodeId);
		const previous = previousNodeId === undefined ? undefined : positions.get(previousNodeId);
		const targets = [
			...(targetsBySource.get(nodeId) ?? []),
		].sort((leftId, rightId) => {
			const left = positions.get(leftId)!;
			const right = positions.get(rightId)!;
			const turnDifference =
				readTurnCost(previous, current, left) - readTurnCost(previous, current, right);
			if (Math.abs(turnDifference) > 1e-9) return turnDifference;
			const flowDifference =
				Math.abs(left.flowOrder - current.flowOrder) -
				Math.abs(right.flowOrder - current.flowOrder);
			if (flowDifference !== 0) return flowDifference;
			const distanceDifference = readDistance(current, left) - readDistance(current, right);
			if (Math.abs(distanceDifference) > 1e-9) return distanceDifference;
			return leftId.localeCompare(rightId);
		});
		for (const targetId of targets) visit(targetId, nodeId);
	};
	visit(startNodeId);
	return ordered;
};
