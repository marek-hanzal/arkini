import { graphlib, layout } from "@dagrejs/dagre";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlow";

export interface EditorItemOriginFlowLayoutNode {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
}

const readNodeSize = (kind: "item" | "source") =>
	kind === "item"
		? {
				height: 76,
				width: 224,
			}
		: {
				height: 96,
				width: 256,
			};

/** Uses the graph topology to keep acquisition stages aligned and minimize crossed edges. */
export const layoutEditorItemOriginFlow = (
	flow: EditorItemOriginFlow,
): ReadonlyMap<string, EditorItemOriginFlowLayoutNode> => {
	const graph = new graphlib.Graph().setDefaultEdgeLabel(() => ({}));
	graph.setGraph({
		acyclicer: "greedy",
		edgesep: 20,
		marginx: 32,
		marginy: 32,
		nodesep: 36,
		rankdir: "LR",
		ranker: "tight-tree",
		ranksep: 96,
	});
	for (const node of flow.nodes) graph.setNode(node.id, readNodeSize(node.kind));
	for (const edge of flow.edges) graph.setEdge(edge.source, edge.target);
	layout(graph);

	return new Map(
		flow.nodes.map((node) => {
			const size = readNodeSize(node.kind);
			const position = graph.node(node.id) as {
				readonly x: number;
				readonly y: number;
			};
			return [
				node.id,
				{
					...size,
					x: position.x - size.width / 2,
					y: position.y - size.height / 2,
				},
			];
		}),
	);
};
