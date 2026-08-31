import { type Dispatch, type SetStateAction, useMemo } from "react";

import { useEditorResourceUrls } from "~/asset-authoring/ui/EditorResourceUrlSession";
import type { EditorItemOriginFlow } from "~/flow/type/EditorItemOriginFlow";
import { readConnectedPortsFn, type ConnectedPorts } from "~/flow-canvas/fn/readConnectedPortsFn";
import { readOriginFlowBackboneBoundsFn } from "~/flow-canvas/fn/readOriginFlowViewportFn";
import type { Bounds } from "~/flow-canvas/type/Viewport";
import type { Highlight, OriginFlowDirection, Selection } from "~/flow-canvas/type/Highlight";
import { useProjection, type HighlightDepth } from "~/flow-canvas/ui/useProjection";
import { readNodeMetricsFn, type NodeMetrics } from "~/flow-layout/fn/readNodeMetricsFn";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";

/** Projects domain flow and layout data into the complete canvas render and navigation model. */
export const useCanvasRenderModel = ({
	backbones,
	direction = "input",
	flow,
	positions,
	selection,
}: useCanvasRenderModel.Props): useCanvasRenderModel.Output => {
	const resourceIds = useMemo(
		() => [
			...new Set(flow.nodes.flatMap((node) => node.resourceIds)),
		],
		[
			flow.nodes,
		],
	);
	const resourceUrls = useEditorResourceUrls(resourceIds);
	const edgeBounds = useMemo(
		() => readOriginFlowBackboneBoundsFn(backbones),
		[
			backbones,
		],
	);
	const connectedPorts = useMemo(
		() => readConnectedPortsFn(flow.edges),
		[
			flow.edges,
		],
	);
	const nodeMetrics = useMemo(
		() =>
			new Map(
				flow.nodes.map(
					(node) =>
						[
							node.id,
							readNodeMetricsFn(node),
						] as const,
				),
			),
		[
			flow.nodes,
		],
	);
	const projection = useProjection({
		backbones,
		direction,
		flow,
		positions,
		selection,
	});

	return {
		connectedPorts,
		edgeBounds,
		highlight: projection.highlight,
		highlightedEdgeColors: projection.highlightedEdgeColors,
		highlightedPortColors: projection.highlightedPortColors,
		inputNavigationNodeIds: projection.inputNavigationNodeIds,
		maxHighlightLevel: projection.maxHighlightLevel,
		metroBackbones: projection.metroBackbones,
		navigationNodeIds: projection.navigationNodeIds,
		nodeMetrics,
		outputNavigationNodeIds: projection.outputNavigationNodeIds,
		resourceUrls,
		rootNavigationNodeIds: projection.rootNavigationNodeIds,
		setHighlightDepth: projection.setHighlightDepth,
	};
};

export namespace useCanvasRenderModel {
	export interface Props {
		readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly direction?: OriginFlowDirection;
		readonly flow: EditorItemOriginFlow;
		readonly positions: ReadonlyMap<string, LayoutNode>;
		readonly selection: Selection | undefined;
	}

	export interface Output {
		readonly connectedPorts: ConnectedPorts;
		readonly edgeBounds: ReadonlyMap<string, Bounds>;
		readonly highlight: Highlight | undefined;
		readonly highlightedEdgeColors: ReadonlyMap<string, string>;
		readonly highlightedPortColors: ReadonlyMap<string, ReadonlyMap<string, string>>;
		readonly inputNavigationNodeIds: ReadonlyArray<string>;
		readonly maxHighlightLevel: number;
		readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly navigationNodeIds: ReadonlyArray<string>;
		readonly nodeMetrics: ReadonlyMap<string, NodeMetrics>;
		readonly outputNavigationNodeIds: ReadonlyArray<string>;
		readonly resourceUrls: ReadonlyMap<string, string>;
		readonly rootNavigationNodeIds: ReadonlyArray<string>;
		readonly setHighlightDepth: Dispatch<SetStateAction<HighlightDepth | undefined>>;
	}
}
