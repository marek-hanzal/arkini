import { Order } from "effect";

import type { ItemOriginFlow } from "~/flow/type/ItemOriginFlow";
import type { Highlight, OriginFlowDirection } from "~/flow-canvas/type/Highlight";

interface FlowNavigationPosition {
	readonly flowOrder: number;
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

type FlowNavigationProjectionRequest =
	| {
			readonly allowedEdgeIds: ReadonlySet<string>;
			readonly direction: OriginFlowDirection;
			readonly flow: ItemOriginFlow;
			readonly kind: "directional";
			readonly positions: ReadonlyMap<string, FlowNavigationPosition>;
			readonly selectedNodeId: string;
	  }
	| {
			readonly flow: ItemOriginFlow;
			readonly kind: "relation";
			readonly selectedNodeId: string;
			readonly selectedRole: "input" | "output";
	  }
	| {
			readonly flow: ItemOriginFlow;
			readonly highlight: Highlight;
			readonly kind: "root";
	  };

const readCenterFn = (position: FlowNavigationPosition) => ({
	x: position.x + position.width / 2,
	y: position.y + position.height / 2,
});

const readDistanceFn = (left: FlowNavigationPosition, right: FlowNavigationPosition) => {
	const leftCenter = readCenterFn(left);
	const rightCenter = readCenterFn(right);
	return Math.hypot(rightCenter.x - leftCenter.x, rightCenter.y - leftCenter.y);
};

const readTurnCostFn = (
	previous: FlowNavigationPosition | undefined,
	current: FlowNavigationPosition,
	target: FlowNavigationPosition,
) => {
	if (previous === undefined) return 0;
	const previousCenter = readCenterFn(previous);
	const currentCenter = readCenterFn(current);
	const targetCenter = readCenterFn(target);
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

const readNavigationFn = (
	flow: ItemOriginFlow,
	positions: ReadonlyMap<string, FlowNavigationPosition>,
	startNodeId: string,
	direction: OriginFlowDirection,
	allowedEdgeIds?: ReadonlySet<string>,
): ReadonlyArray<string> => {
	if (!flow.nodes.some(({ id }) => id === startNodeId) || !positions.has(startNodeId)) return [];

	const targetsBySource = new Map<string, Set<string>>();
	for (const edge of flow.edges) {
		if (allowedEdgeIds !== undefined && !allowedEdgeIds.has(edge.id)) continue;
		const sourceId = direction === "output" ? edge.target : edge.source;
		const targetId = direction === "output" ? edge.source : edge.target;
		const source = positions.get(sourceId);
		const target = positions.get(targetId);
		if (source === undefined || target === undefined) continue;
		const movesWithDirection =
			allowedEdgeIds !== undefined ||
			(direction === "output"
				? target.flowOrder < source.flowOrder
				: target.flowOrder > source.flowOrder);
		if (!movesWithDirection) continue;
		const targets = targetsBySource.get(sourceId) ?? new Set<string>();
		targets.add(targetId);
		targetsBySource.set(sourceId, targets);
	}

	const visited = new Set<string>();
	const ordered: string[] = [];
	const visitFn = (nodeId: string, previousNodeId?: string) => {
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
				readTurnCostFn(previous, current, left) - readTurnCostFn(previous, current, right);
			if (Math.abs(turnDifference) > 1e-9) return turnDifference;
			const flowDifference =
				Math.abs(left.flowOrder - current.flowOrder) -
				Math.abs(right.flowOrder - current.flowOrder);
			if (flowDifference !== 0) return flowDifference;
			const distanceDifference =
				readDistanceFn(current, left) - readDistanceFn(current, right);
			if (Math.abs(distanceDifference) > 1e-9) return distanceDifference;
			return Order.String(leftId, rightId);
		});
		for (const targetId of targets) visitFn(targetId, nodeId);
	};
	visitFn(startNodeId);
	return ordered;
};

const readRelationNavigationFn = (
	flow: ItemOriginFlow,
	selectedNodeId: string,
	selectedRole: "input" | "output",
): ReadonlyArray<string> => {
	const nodesById = new Map(
		flow.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const relatedNodeIds = new Set<string>();
	for (const edge of flow.edges) {
		const relatedNodeId =
			selectedRole === "input"
				? edge.role === "input" && edge.source === selectedNodeId
					? edge.target
					: undefined
				: edge.role === "output" && edge.target === selectedNodeId
					? edge.source
					: undefined;
		if (
			relatedNodeId === undefined ||
			relatedNodeId === selectedNodeId ||
			!nodesById.has(relatedNodeId)
		)
			continue;
		relatedNodeIds.add(relatedNodeId);
	}
	return [
		...relatedNodeIds,
	].sort((leftId, rightId) => {
		const left = nodesById.get(leftId)!;
		const right = nodesById.get(rightId)!;
		return (
			Order.String(left.title, right.title) ||
			Order.String(left.itemId, right.itemId) ||
			Order.String(leftId, rightId)
		);
	});
};

const readRootNavigationFn = (
	flow: ItemOriginFlow,
	highlight: Highlight,
): ReadonlyArray<string> => {
	const nodesById = new Map(
		flow.nodes.map((node) => [
			node.id,
			node,
		]),
	);
	const adjacency = new Map<string, Set<string>>();
	const connectFn = (left: string, right: string) => {
		const neighbors = adjacency.get(left) ?? new Set<string>();
		neighbors.add(right);
		adjacency.set(left, neighbors);
	};
	for (const edge of flow.edges) {
		if (!highlight.edgeIds.has(edge.id) || edge.source === edge.target) continue;
		connectFn(edge.source, edge.target);
		connectFn(edge.target, edge.source);
	}
	return [
		...highlight.nodeIds,
	]
		.filter((nodeId) => {
			const level = highlight.nodeLevels.get(nodeId);
			if (level === undefined) return false;
			return [
				...(adjacency.get(nodeId) ?? []),
			].every((neighborId) => (highlight.nodeLevels.get(neighborId) ?? -1) <= level);
		})
		.sort((leftId, rightId) => {
			const leftLevel = highlight.nodeLevels.get(leftId) ?? 0;
			const rightLevel = highlight.nodeLevels.get(rightId) ?? 0;
			if (leftLevel !== rightLevel) return rightLevel - leftLevel;
			const left = nodesById.get(leftId);
			const right = nodesById.get(rightId);
			const starterDifference =
				Number((right?.starterScopes.length ?? 0) > 0) -
				Number((left?.starterScopes.length ?? 0) > 0);
			if (starterDifference !== 0) return starterDifference;
			return (
				Order.String(left?.title ?? leftId, right?.title ?? rightId) ||
				Order.String(leftId, rightId)
			);
		});
};

/** Projects one exact keyboard traversal without coupling unrelated cursor identities. */
export const readFlowNavigationProjectionFn = (
	request: FlowNavigationProjectionRequest,
): ReadonlyArray<string> => {
	switch (request.kind) {
		case "directional":
			return readNavigationFn(
				request.flow,
				request.positions,
				request.selectedNodeId,
				request.direction,
				request.allowedEdgeIds,
			);
		case "relation":
			return readRelationNavigationFn(
				request.flow,
				request.selectedNodeId,
				request.selectedRole,
			);
		case "root":
			return readRootNavigationFn(request.flow, request.highlight);
	}
};
