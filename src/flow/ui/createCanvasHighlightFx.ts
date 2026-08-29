import { Effect } from "effect";

import type { EditorItemOriginItemNode } from "~/flow/domain/EditorItemOriginFlow";
import type { Highlight, Selection } from "~/flow/ui/Highlight";

const HighlightMinimumOpacity = 0.28;
const HighlightOpacityStep = 0.12;

const readHighlightOpacity = (level: number | undefined) =>
	level === undefined
		? 1
		: Math.max(HighlightMinimumOpacity, 1 - Math.max(0, level) * HighlightOpacityStep);

const readNodeHighlight = (
	node: EditorItemOriginItemNode,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
	navigationFocusNodeId: string | undefined,
) => {
	if (selection?.kind === "node" && selection.id === node.id) return "selected" as const;
	if (navigationFocusNodeId === node.id || highlight?.nodeIds.has(node.id))
		return "active" as const;
	return "idle" as const;
};

const readNodeOpacity = (
	nodeId: string,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
	navigationFocusNodeId: string | undefined,
) => {
	if (selection === undefined) return 1;
	if (selection.kind === "edge") return highlight?.nodeIds.has(nodeId) === true ? 1 : 0.2;
	if (selection.id === nodeId || navigationFocusNodeId === nodeId) return 1;
	const level = highlight?.nodeLevels.get(nodeId);
	return level === undefined ? 0 : readHighlightOpacity(level);
};

const readEdgeOpacity = (
	edgeId: string,
	highlighted: boolean,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
) => {
	if (!highlighted) return selection?.kind === "node" ? 0 : 0.6;
	if (selection?.kind !== "node") return 1;
	return readHighlightOpacity(highlight?.edgeLevels.get(edgeId));
};

/** Creates the visual emphasis policy for Canvas flow nodes and routes. */
export const createCanvasHighlightFx = Effect.fn("createCanvasHighlightFx")(() =>
	Effect.succeed({
		readEdgeOpacity,
		readNodeHighlight,
		readNodeOpacity,
	} as const),
);
