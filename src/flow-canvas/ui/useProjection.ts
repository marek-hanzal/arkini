import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { EditorItemOriginFlow } from "~/flow/type/EditorItemOriginFlow";
import { readFlowNavigationProjectionFn } from "~/flow-canvas/fn/readFlowNavigationProjectionFn";
import { readHighlightFn } from "~/flow-canvas/fn/readHighlightFn";
import { readMetroBackbonesFn } from "~/flow-canvas/fn/readMetroBackbonesFn";
import { readRouteColorsFn } from "~/flow-canvas/fn/readRouteColorsFn";
import type { Highlight, OriginFlowDirection, Selection } from "~/flow-canvas/type/Highlight";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";

export const DefaultHighlightDepth = 1;

export interface HighlightDepth {
	readonly direction: OriginFlowDirection;
	readonly limit: number;
	readonly nodeId: string;
}

const readVisibleHighlightFn = (highlight: Highlight, maxLevel: number): Highlight => {
	const boundedLevel = Math.max(0, Math.floor(maxLevel));
	const nodeLevels = new Map(
		[
			...highlight.nodeLevels,
		].filter(([, level]) => level <= boundedLevel),
	);
	const edgeLevels = new Map(
		[
			...highlight.edgeLevels,
		].filter(([, level]) => level <= boundedLevel),
	);
	return {
		edgeIds: new Set(edgeLevels.keys()),
		edgeLevels,
		nodeIds: new Set(nodeLevels.keys()),
		nodeLevels,
	};
};

/** Owns the complete direction-aware selection and navigation projection for one flow canvas. */
export const useProjection = ({
	backbones,
	direction,
	flow,
	positions,
	selection,
}: useProjection.Props): useProjection.Output => {
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
	const metroBackbones = useMemo(() => {
		const result = readMetroBackbonesFn(backbones, [
			...routeColors.edges.keys(),
		]);
		if (!result.ok) throw new Error(result.message);
		return result.backbones;
	}, [
		backbones,
		routeColors.edges,
	]);
	const navigationNodeIds = useMemo(
		() =>
			selection?.kind === "node" && highlight !== undefined
				? readFlowNavigationProjectionFn({
						allowedEdgeIds: highlight.edgeIds,
						direction,
						flow,
						kind: "directional",
						positions,
						selectedNodeId: selection.id,
					})
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
				? readFlowNavigationProjectionFn({
						flow,
						kind: "relation",
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
				? readFlowNavigationProjectionFn({
						flow,
						kind: "relation",
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
				? readFlowNavigationProjectionFn({
						flow,
						highlight: completeHighlight,
						kind: "root",
					})
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
		highlightedEdgeColors: routeColors.edges,
		highlightedPortColors: routeColors.ports,
		inputNavigationNodeIds,
		maxHighlightLevel,
		metroBackbones,
		navigationNodeIds,
		outputNavigationNodeIds,
		rootNavigationNodeIds,
		setHighlightDepth,
	};
};

export namespace useProjection {
	export interface Props {
		readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly direction: OriginFlowDirection;
		readonly flow: EditorItemOriginFlow;
		readonly positions: ReadonlyMap<string, LayoutNode>;
		readonly selection: Selection | undefined;
	}

	export interface Output {
		readonly highlight: Highlight | undefined;
		readonly highlightedEdgeColors: ReadonlyMap<string, string>;
		readonly highlightedPortColors: ReadonlyMap<string, ReadonlyMap<string, string>>;
		readonly inputNavigationNodeIds: ReadonlyArray<string>;
		readonly maxHighlightLevel: number;
		readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly navigationNodeIds: ReadonlyArray<string>;
		readonly outputNavigationNodeIds: ReadonlyArray<string>;
		readonly rootNavigationNodeIds: ReadonlyArray<string>;
		readonly setHighlightDepth: Dispatch<SetStateAction<HighlightDepth | undefined>>;
	}
}
