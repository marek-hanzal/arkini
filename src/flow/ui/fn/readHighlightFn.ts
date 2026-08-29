import type { EditorItemOriginFlow } from "~/flow/domain/EditorItemOriginFlow";
import type { OriginFlowDirection, Highlight, Selection } from "~/flow/ui/Highlight";
import { readHighlightLevelsFn } from "~/flow/ui/fn/readHighlightLevelsFn";
import { readOutputHighlightFn } from "~/flow/ui/fn/readOutputHighlightFn";
import { readInputHighlightFn } from "~/flow/ui/fn/readInputHighlightFn";

const readEmptyHighlight = (): Highlight => ({
	edgeIds: new Set(),
	edgeLevels: new Map(),
	nodeIds: new Set(),
	nodeLevels: new Map(),
});

/** Reads the complete directional graph selected by an item or connection. */
export const readHighlightFn = (
	flow: EditorItemOriginFlow,
	selection: Selection,
	direction: OriginFlowDirection = "input",
) => {
	const readNodeHighlightFn =
		direction === "output" ? readOutputHighlightFn : readInputHighlightFn;
	if (selection.kind === "node") {
		const selectedNode = flow.nodes.find(({ id }) => id === selection.id);
		if (selectedNode === undefined) return readEmptyHighlight();
		const highlight = readNodeHighlightFn(flow, selectedNode);
		return readHighlightLevelsFn(flow, highlight, selectedNode.id);
	}

	const selectedEdge = flow.edges.find(({ id }) => id === selection.id);
	if (selectedEdge === undefined) return readEmptyHighlight();
	const startNodeId = direction === "output" ? selectedEdge.source : selectedEdge.target;
	const startNode = flow.nodes.find(({ id }) => id === startNodeId);
	if (startNode === undefined)
		return {
			edgeIds: new Set([
				selectedEdge.id,
			]),
			edgeLevels: new Map(),
			nodeIds: new Set([
				selectedEdge.source,
				selectedEdge.target,
			]),
			nodeLevels: new Map(),
		};
	const highlight = readNodeHighlightFn(flow, startNode);
	return readHighlightLevelsFn(
		flow,
		{
			edgeIds: new Set([
				selectedEdge.id,
				...highlight.edgeIds,
			]),
			edgeLevels: new Map(),
			nodeIds: new Set([
				selectedEdge.source,
				selectedEdge.target,
				...highlight.nodeIds,
			]),
			nodeLevels: new Map(),
		},
		startNode.id,
	);
};
