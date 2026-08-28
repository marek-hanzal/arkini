import { Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import type {
	OriginFlowDirection,
	Highlight,
	Selection,
} from "~/ui/item/editor/origin-flow/Highlight";
import { readHighlightLevelsFx } from "~/ui/item/editor/origin-flow/readHighlightLevelsFx";
import { readOutputHighlightFx } from "~/ui/item/editor/origin-flow/readOutputHighlightFx";
import { readInputHighlightFx } from "~/ui/item/editor/origin-flow/readInputHighlightFx";

const readEmptyHighlight = (): Highlight => ({
	edgeIds: new Set(),
	edgeLevels: new Map(),
	nodeIds: new Set(),
	nodeLevels: new Map(),
});

/** Reads the complete directional graph selected by an item or connection. */
export const readHighlightFx = Effect.fn("readHighlightFx")(
	function* (
		flow: EditorItemOriginFlow,
		selection: Selection,
		direction: OriginFlowDirection = "input",
	) {
		const readNodeHighlightFx =
			direction === "output"
				? readOutputHighlightFx
				: readInputHighlightFx;
		if (selection.kind === "node") {
			const selectedNode = flow.nodes.find(({ id }) => id === selection.id);
			if (selectedNode === undefined) return readEmptyHighlight();
			const highlight = yield* readNodeHighlightFx(flow, selectedNode);
			return yield* readHighlightLevelsFx(flow, highlight, selectedNode.id);
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
		const highlight = yield* readNodeHighlightFx(flow, startNode);
		return yield* readHighlightLevelsFx(
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
	},
);
