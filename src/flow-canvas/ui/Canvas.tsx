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
	readonly onSelectionChange: (selection: Selection | undefined) => void;
	readonly onItemOpen: (itemId: string) => void;
}

/** Composes flow projection, imperative rendering, keyboard navigation, and pointer interaction. */
export const Canvas = ({
	backbones,
	direction = "input",
	fitContent,
	flow,
	focusNodeId,
	focusRequestKey,
	onSelectionChange,
	onItemOpen,
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
		onSelectionChange,
		outputNodeIds: model.outputNavigationNodeIds,
		positions,
		relationFocusNodeIdRef,
		rootNodeIds: model.rootNavigationNodeIds,
		scheduleDraw: renderer.scheduleDraw,
		selection,
		setHighlightDepth: model.setHighlightDepth,
		viewportRef: renderer.viewportRef,
	});

	useEffect(() => {
		if (focusNodeId === undefined || !renderer.focusNode(focusNodeId)) return;
		navigation.resetNavigation();
	}, [
		focusNodeId,
		focusRequestKey,
		navigation.resetNavigation,
		renderer.focusNode,
	]);

	const pointer = useCanvasPointer({
		backbones,
		connectedPorts: model.connectedPorts,
		flow,
		highlight: model.highlight,
		metroBackbones: model.metroBackbones,
		nodeMetrics: model.nodeMetrics,
		onItemOpen,
		onSelectionChange,
		positions,
		resetNavigation: navigation.resetNavigation,
		scheduleDraw: renderer.scheduleDraw,
		selection,
		viewportRef: renderer.viewportRef,
		visitHistoryRef: navigation.visitHistoryRef,
	});

	return (
		<>
			<canvas
				className="block size-full touch-none cursor-grab text-foreground"
				data-ui="EditorOriginFlowCanvas"
				onPointerCancel={pointer.handlePointerCancel}
				onPointerDown={pointer.handlePointerDown}
				onPointerMove={pointer.handlePointerMove}
				onPointerUp={pointer.handlePointerUp}
				ref={renderer.canvasRef}
			/>
			{navigation.helpOpen ? (
				<CanvasShortcutHelp
					direction={direction}
					onClose={() => navigation.setHelpOpen(false)}
				/>
			) : null}
		</>
	);
};
