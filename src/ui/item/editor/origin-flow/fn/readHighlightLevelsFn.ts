import type { EditorItemOriginFlow } from "~/editor/origin-flow/EditorItemOriginFlow";
import type { Highlight } from "~/ui/item/editor/origin-flow/Highlight";

/** Assigns breadth-first visual depth to every node and edge in one selected flow. */
export const readHighlightLevelsFn = (
	flow: EditorItemOriginFlow,
	highlight: Highlight,
	rootNodeId: string,
): Highlight => {
	const edges = flow.edges.filter(({ id }) => highlight.edgeIds.has(id));
	const adjacency = new Map<string, string[]>();
	const connect = (left: string, right: string) => {
		const neighbors = adjacency.get(left) ?? [];
		neighbors.push(right);
		adjacency.set(left, neighbors);
	};
	for (const edge of edges) {
		if (edge.source === edge.target) continue;
		connect(edge.source, edge.target);
		connect(edge.target, edge.source);
	}

	const nodeLevels = new Map<string, number>([
		[
			rootNodeId,
			0,
		],
	]);
	const queue = [
		rootNodeId,
	];
	for (let index = 0; index < queue.length; index += 1) {
		const nodeId = queue[index]!;
		const nextLevel = nodeLevels.get(nodeId)! + 1;
		for (const neighborId of adjacency.get(nodeId) ?? []) {
			if (!highlight.nodeIds.has(neighborId) || nodeLevels.has(neighborId)) continue;
			nodeLevels.set(neighborId, nextLevel);
			queue.push(neighborId);
		}
	}

	const edgeLevels = new Map<string, number>();
	for (const edge of edges) {
		const sourceLevel = nodeLevels.get(edge.source);
		const targetLevel = nodeLevels.get(edge.target);
		if (sourceLevel === undefined || targetLevel === undefined) continue;
		edgeLevels.set(edge.id, Math.max(sourceLevel, targetLevel));
	}

	return {
		...highlight,
		edgeLevels,
		nodeLevels,
	};
};
