import { Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";

/** Reads stable item navigation for nodes that use the selected item in one operation role. */
export const readEditorOriginFlowRelationNavigationFx = Effect.fn(
	"readEditorOriginFlowRelationNavigationFx",
)(
	({
		flow,
		selectedNodeId,
		selectedRole,
	}: {
		readonly flow: EditorItemOriginFlow;
		readonly selectedNodeId: string;
		readonly selectedRole: "input" | "output";
	}) =>
		Effect.sync((): ReadonlyArray<string> => {
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
					left.title.localeCompare(right.title) ||
					left.itemId.localeCompare(right.itemId) ||
					leftId.localeCompare(rightId)
				);
			});
		}),
);
