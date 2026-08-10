import { useEffect, useMemo, useState } from "react";

import type { EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import {
	type EditorOriginFlowDirection,
	type EditorOriginFlowSelection,
	readEditorOriginFlowHighlightFx,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { readEditorOriginFlowMetroBackbonesFx } from "~/ui/item/editor/readEditorOriginFlowMetroBackbonesFx";
import { readEditorOriginFlowNavigationFx } from "~/ui/item/editor/readEditorOriginFlowNavigationFx";
import { readEditorOriginFlowRelationNavigationFx } from "~/ui/item/editor/readEditorOriginFlowRelationNavigationFx";
import { readEditorOriginFlowRootNavigationFx } from "~/ui/item/editor/readEditorOriginFlowRootNavigationFx";
import { readEditorOriginFlowRouteColorsFx } from "~/ui/item/editor/readEditorOriginFlowRouteColorsFx";
import { readEditorOriginFlowVisibleHighlightFx } from "~/ui/item/editor/readEditorOriginFlowVisibleHighlightFx";

export const EditorOriginFlowDefaultHighlightDepth = 1;

export interface EditorOriginFlowHighlightDepth {
	readonly direction: EditorOriginFlowDirection;
	readonly limit: number;
	readonly nodeId: string;
}

/** Owns the complete direction-aware selection and navigation projection for one flow canvas. */
export const useEditorOriginFlowProjection = ({
	backbones,
	direction,
	flow,
	positions,
	selection,
}: {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly direction: EditorOriginFlowDirection;
	readonly flow: EditorItemOriginFlow;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly selection: EditorOriginFlowSelection | undefined;
}) => {
	const [highlightDepth, setHighlightDepth] = useState<EditorOriginFlowHighlightDepth>();
	const completeHighlight = useMemo(
		() =>
			selection === undefined
				? undefined
				: RendererRuntime.runSync(
						readEditorOriginFlowHighlightFx(flow, selection, direction),
					),
		[
			direction,
			flow,
			selection,
		],
	);
	const maxHighlightLevel = useMemo(
		() =>
			completeHighlight === undefined
				? 0
				: Math.max(0, ...completeHighlight.nodeLevels.values()),
		[
			completeHighlight,
		],
	);
	const highlightDepthLimit =
		selection?.kind === "node"
			? Math.min(
					highlightDepth?.nodeId === selection.id &&
						highlightDepth.direction === direction
						? highlightDepth.limit
						: EditorOriginFlowDefaultHighlightDepth,
					maxHighlightLevel,
				)
			: undefined;
	const highlight = useMemo(
		() =>
			selection?.kind !== "node" ||
			completeHighlight === undefined ||
			highlightDepthLimit === undefined ||
			highlightDepthLimit >= maxHighlightLevel
				? completeHighlight
				: RendererRuntime.runSync(
						readEditorOriginFlowVisibleHighlightFx(
							completeHighlight,
							highlightDepthLimit,
						),
					),
		[
			completeHighlight,
			highlightDepthLimit,
			maxHighlightLevel,
			selection,
		],
	);
	const routeColors = useMemo(
		() =>
			RendererRuntime.runSync(readEditorOriginFlowRouteColorsFx(flow, selection, highlight)),
		[
			flow,
			highlight,
			selection,
		],
	);
	const highlightedEdgeColors = routeColors.edges;
	const metroBackbones = useMemo(
		() =>
			RendererRuntime.runSync(
				readEditorOriginFlowMetroBackbonesFx(backbones, [
					...highlightedEdgeColors.keys(),
				]),
			),
		[
			backbones,
			highlightedEdgeColors,
		],
	);
	const highlightedPortColors = routeColors.ports;
	const navigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? RendererRuntime.runSync(
						readEditorOriginFlowNavigationFx(
							flow,
							positions,
							selection.id,
							direction,
							highlight?.edgeIds,
						),
					)
				: [],
		[
			direction,
			flow,
			highlight,
			positions,
			selection,
		],
	);
	const inputNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? RendererRuntime.runSync(
						readEditorOriginFlowRelationNavigationFx({
							flow,
							selectedNodeId: selection.id,
							selectedRole: "input",
						}),
					)
				: [],
		[
			flow,
			selection,
		],
	);
	const outputNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? RendererRuntime.runSync(
						readEditorOriginFlowRelationNavigationFx({
							flow,
							selectedNodeId: selection.id,
							selectedRole: "output",
						}),
					)
				: [],
		[
			flow,
			selection,
		],
	);
	const rootNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node" && completeHighlight !== undefined
				? RendererRuntime.runSync(
						readEditorOriginFlowRootNavigationFx(flow, completeHighlight),
					)
				: [],
		[
			completeHighlight,
			flow,
			selection,
		],
	);

	useEffect(
		() => setHighlightDepth(undefined),
		[
			direction,
			selection,
		],
	);

	return {
		highlight,
		highlightedEdgeColors,
		highlightedPortColors,
		inputNavigationNodeIds,
		maxHighlightLevel,
		metroBackbones,
		navigationNodeIds,
		outputNavigationNodeIds,
		rootNavigationNodeIds,
		setHighlightDepth,
	};
};
