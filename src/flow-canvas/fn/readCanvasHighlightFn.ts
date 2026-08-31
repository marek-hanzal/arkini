import type { ItemOriginItemNode } from "~/flow/type/ItemOriginFlow";
import type { Highlight, Selection } from "~/flow-canvas/type/Highlight";

const HighlightMinimumOpacity = 0.28;
const HighlightOpacityStep = 0.12;

const readHighlightOpacityFn = (level: number | undefined) =>
	level === undefined
		? 1
		: Math.max(HighlightMinimumOpacity, 1 - Math.max(0, level) * HighlightOpacityStep);

export const readCanvasNodeHighlightFn = (
	node: ItemOriginItemNode,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
	navigationFocusNodeId: string | undefined,
) => {
	if (selection?.kind === "node" && selection.id === node.id) return "selected" as const;
	if (navigationFocusNodeId === node.id || highlight?.nodeIds.has(node.id))
		return "active" as const;
	return "idle" as const;
};

export const readCanvasNodeOpacityFn = (
	nodeId: string,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
	navigationFocusNodeId: string | undefined,
) => {
	if (selection === undefined) return 1;
	if (selection.kind === "edge") return highlight?.nodeIds.has(nodeId) === true ? 1 : 0.2;
	if (selection.id === nodeId || navigationFocusNodeId === nodeId) return 1;
	const level = highlight?.nodeLevels.get(nodeId);
	return level === undefined ? 0 : readHighlightOpacityFn(level);
};

export const readCanvasEdgeOpacityFn = (
	edgeId: string,
	highlighted: boolean,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
) => {
	if (!highlighted) return selection?.kind === "node" ? 0 : 0.6;
	if (selection?.kind !== "node") return 1;
	return readHighlightOpacityFn(highlight?.edgeLevels.get(edgeId));
};
