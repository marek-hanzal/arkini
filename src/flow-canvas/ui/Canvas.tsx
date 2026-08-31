import { useEffect, useRef } from "react";

import type { Selection } from "~/flow-canvas/type/Highlight";
import { CanvasShortcutHelp } from "~/flow-canvas/ui/CanvasShortcutHelp";
import { useCanvasPointer } from "~/flow-canvas/ui/useCanvasPointer";
import { useCanvasRenderer } from "~/flow-canvas/ui/useCanvasRenderer";
import { useCanvasRenderModel } from "~/flow-canvas/ui/useCanvasRenderModel";
import { useNavigation } from "~/flow-canvas/ui/useNavigation";

interface CanvasProps extends useCanvasRenderModel.Props {
	readonly fitContent: boolean;
	readonly focusNodeId?: string;
	readonly focusRequestKey?: number;
	readonly onSelectionChangeFn: (selection: Selection | undefined) => void;
	readonly onItemOpenFn: (itemId: string) => void;
}

/** Composes flow projection, imperative rendering, keyboard navigation, and pointer interaction. */
export const Canvas = ({
	backbones,
	direction = "input",
	fitContent,
	flow,
	focusNodeId,
	focusRequestKey,
	onSelectionChangeFn,
	onItemOpenFn,
	positions,
	selection,
}: CanvasProps) => {
	const model = useCanvasRenderModel({
		backbones,
		direction,
		flow,
		positions,
		selection,
	});
	const relationFocusNodeIdRef = useRef<string | undefined>(undefined);
	const renderer = useCanvasRenderer({
		backbones,
		connectedPorts: model.connectedPorts,
		edgeBounds: model.edgeBounds,
		fitContent,
		focusNodeId,
		flow,
		highlight: model.highlight,
		highlightedEdgeColors: model.highlightedEdgeColors,
		highlightedPortColors: model.highlightedPortColors,
		metroBackbones: model.metroBackbones,
		nodeMetrics: model.nodeMetrics,
		positions,
		relationFocusNodeIdRef,
		resourceUrls: model.resourceUrls,
		selection,
	});
	const navigation = useNavigation({
		canvasRef: renderer.canvasRef,
		direction,
		flow,
		inputNodeIds: model.inputNavigationNodeIds,
		maxHighlightLevel: model.maxHighlightLevel,
		navigationNodeIds: model.navigationNodeIds,
		onSelectionChangeFn,
		outputNodeIds: model.outputNavigationNodeIds,
		positions,
		relationFocusNodeIdRef,
		rootNodeIds: model.rootNavigationNodeIds,
		scheduleDrawFn: renderer.scheduleDrawFn,
		selection,
		setHighlightDepthFn: model.setHighlightDepthFn,
		viewportRef: renderer.viewportRef,
	});

	useEffect(() => {
		if (focusNodeId === undefined || !renderer.focusNodeFn(focusNodeId)) return;
		navigation.resetNavigationFn();
	}, [
		focusNodeId,
		focusRequestKey,
		navigation.resetNavigationFn,
		renderer.focusNodeFn,
	]);

	const pointer = useCanvasPointer({
		backbones,
		connectedPorts: model.connectedPorts,
		flow,
		highlight: model.highlight,
		metroBackbones: model.metroBackbones,
		nodeMetrics: model.nodeMetrics,
		onItemOpenFn,
		onSelectionChangeFn,
		positions,
		resetNavigationFn: navigation.resetNavigationFn,
		scheduleDrawFn: renderer.scheduleDrawFn,
		selection,
		viewportRef: renderer.viewportRef,
		visitHistoryRef: navigation.visitHistoryRef,
	});

	return (
		<>
			<canvas
				className="block size-full touch-none cursor-grab text-foreground"
				data-ui="EditorOriginFlowCanvas"
				onPointerCancel={pointer.handlePointerCancelFn}
				onPointerDown={pointer.handlePointerDownFn}
				onPointerMove={pointer.handlePointerMoveFn}
				onPointerUp={pointer.handlePointerUpFn}
				ref={renderer.canvasRef}
			/>
			{navigation.helpOpen ? (
				<CanvasShortcutHelp
					direction={direction}
					onCloseFn={() => navigation.setHelpOpenFn(false)}
				/>
			) : null}
		</>
	);
};
