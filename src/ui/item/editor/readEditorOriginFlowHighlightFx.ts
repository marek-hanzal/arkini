import { Effect } from "effect";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import type {
	EditorOriginFlowDirection,
	EditorOriginFlowHighlight,
	EditorOriginFlowSelection,
} from "~/ui/item/editor/EditorOriginFlowHighlight";
import { readEditorOriginFlowHighlightLevelsFx } from "~/ui/item/editor/readEditorOriginFlowHighlightLevelsFx";
import { readEditorOriginFlowIncomeHighlightFx } from "~/ui/item/editor/readEditorOriginFlowIncomeHighlightFx";
import { readEditorOriginFlowOutcomeHighlightFx } from "~/ui/item/editor/readEditorOriginFlowOutcomeHighlightFx";

export type {
	EditorOriginFlowDirection,
	EditorOriginFlowHighlight,
	EditorOriginFlowSelection,
} from "~/ui/item/editor/EditorOriginFlowHighlight";

const readEmptyHighlight = (): EditorOriginFlowHighlight => ({
	edgeIds: new Set(),
	edgeLevels: new Map(),
	nodeIds: new Set(),
	nodeLevels: new Map(),
});

/** Reads the complete directional graph selected by an item or connection. */
export const readEditorOriginFlowHighlightFx = Effect.fn("readEditorOriginFlowHighlightFx")(
	function* (
		flow: EditorItemOriginFlow,
		selection: EditorOriginFlowSelection,
		direction: EditorOriginFlowDirection = "income",
	) {
		const readNodeHighlightFx =
			direction === "income"
				? readEditorOriginFlowIncomeHighlightFx
				: readEditorOriginFlowOutcomeHighlightFx;
		if (selection.kind === "node") {
			const selectedNode = flow.nodes.find(({ id }) => id === selection.id);
			if (selectedNode === undefined) return readEmptyHighlight();
			const highlight = yield* readNodeHighlightFx(flow, selectedNode);
			return yield* readEditorOriginFlowHighlightLevelsFx(flow, highlight, selectedNode.id);
		}

		const selectedEdge = flow.edges.find(({ id }) => id === selection.id);
		if (selectedEdge === undefined) return readEmptyHighlight();
		const startNodeId = direction === "income" ? selectedEdge.source : selectedEdge.target;
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
		return yield* readEditorOriginFlowHighlightLevelsFx(
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
