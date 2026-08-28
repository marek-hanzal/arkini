import { Effect } from "effect";

import type { EditorItemOriginFlow } from "~/editor/origin-flow/EditorItemOriginFlow";
import type { Highlight } from "~/ui/item/editor/origin-flow/Highlight";

/** Reads terminal/root nodes from the complete selected directional graph, farthest first. */
export const readRootNavigationFx = Effect.fn("readRootNavigationFx")(
	(flow: EditorItemOriginFlow, highlight: Highlight) =>
		Effect.sync((): ReadonlyArray<string> => {
			const nodesById = new Map(
				flow.nodes.map((node) => [
					node.id,
					node,
				]),
			);
			const adjacency = new Map<string, Set<string>>();
			const connect = (left: string, right: string) => {
				const neighbors = adjacency.get(left) ?? new Set<string>();
				neighbors.add(right);
				adjacency.set(left, neighbors);
			};
			for (const edge of flow.edges) {
				if (!highlight.edgeIds.has(edge.id) || edge.source === edge.target) continue;
				connect(edge.source, edge.target);
				connect(edge.target, edge.source);
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
						(left?.title ?? leftId).localeCompare(right?.title ?? rightId) ||
						leftId.localeCompare(rightId)
					);
				});
		}),
);
