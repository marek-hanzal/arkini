import { useEffect, useMemo, useState } from "react";

import type { EditorItemOriginFlow } from "~/editor/origin-flow/EditorItemOriginFlow";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { readHighlightFn } from "~/ui/item/editor/origin-flow/fn/readHighlightFn";
import { readNavigationFn } from "~/ui/item/editor/origin-flow/fn/readNavigationFn";
import { readRelationNavigationFn } from "~/ui/item/editor/origin-flow/fn/readRelationNavigationFn";
import { readRootNavigationFn } from "~/ui/item/editor/origin-flow/fn/readRootNavigationFn";
import { readRouteColorsFn } from "~/ui/item/editor/origin-flow/fn/readRouteColorsFn";
import { readVisibleHighlightFn } from "~/ui/item/editor/origin-flow/fn/readVisibleHighlightFn";
import type { LayoutNode, LayoutPoint } from "~/ui/item/editor/origin-flow/Layout";
import type { OriginFlowDirection, Selection } from "~/ui/item/editor/origin-flow/Highlight";
import { readMetroBackbonesFx } from "~/ui/item/editor/origin-flow/readMetroBackbonesFx";

export const DefaultHighlightDepth = 1;

export interface HighlightDepth {
	readonly direction: OriginFlowDirection;
	readonly limit: number;
	readonly nodeId: string;
}

/** Owns the complete direction-aware selection and navigation projection for one flow canvas. */
export const useProjection = ({
	backbones,
	direction,
	flow,
	positions,
	selection,
}: {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly direction: OriginFlowDirection;
	readonly flow: EditorItemOriginFlow;
	readonly positions: ReadonlyMap<string, LayoutNode>;
	readonly selection: Selection | undefined;
}) => {
	const [highlightDepth, setHighlightDepth] = useState<HighlightDepth>();
	const completeHighlight = useMemo(
		() => (selection === undefined ? undefined : readHighlightFn(flow, selection, direction)),
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
						: DefaultHighlightDepth,
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
				: readVisibleHighlightFn(completeHighlight, highlightDepthLimit),
		[
			completeHighlight,
			highlightDepthLimit,
			maxHighlightLevel,
			selection,
		],
	);
	const routeColors = useMemo(
		() => readRouteColorsFn(flow, selection, highlight),
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
				readMetroBackbonesFx(backbones, [
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
				? readNavigationFn(flow, positions, selection.id, direction, highlight?.edgeIds)
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
				? readRelationNavigationFn({
						flow,
						selectedNodeId: selection.id,
						selectedRole: "input",
					})
				: [],
		[
			flow,
			selection,
		],
	);
	const outputNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? readRelationNavigationFn({
						flow,
						selectedNodeId: selection.id,
						selectedRole: "output",
					})
				: [],
		[
			flow,
			selection,
		],
	);
	const rootNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node" && completeHighlight !== undefined
				? readRootNavigationFn(flow, completeHighlight)
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
