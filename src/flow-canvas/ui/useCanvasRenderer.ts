import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { ItemOriginFlow } from "~/flow/type/ItemOriginFlow";
import {
	readCanvasEdgeOpacityFn,
	readCanvasNodeHighlightFn,
	readCanvasNodeOpacityFn,
} from "~/flow-canvas/fn/readCanvasHighlightFn";
import {
	isOriginFlowEdgeVisibleFn,
	isOriginFlowNodeVisibleFn,
	clampOriginFlowViewportZoomFn,
	readDefaultOriginFlowViewportFn,
	readOriginFlowFitViewportFn,
	readOriginFlowInitialFocusFn,
	readOriginFlowNodeViewportFn,
	readOriginFlowVisibleBoundsFn,
} from "~/flow-canvas/fn/readOriginFlowViewportFn";
import type { ConnectedPorts } from "~/flow-canvas/fn/readConnectedPortsFn";
import type { Highlight, Selection } from "~/flow-canvas/type/Highlight";
import type { Bounds, Viewport } from "~/flow-canvas/type/Viewport";
import { useCanvasArtworkPainter } from "~/flow-canvas/ui/useCanvasArtworkPainter";
import { useCanvasItemNodePainter } from "~/flow-canvas/ui/useCanvasItemNodePainter";
import { useCanvasPalette } from "~/flow-canvas/ui/useCanvasPalette";
import { useCanvasRoutePainter } from "~/flow-canvas/ui/useCanvasRoutePainter";
import type { NodeMetrics } from "~/flow-layout/fn/readNodeMetricsFn";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";

type RenderState = Omit<useCanvasRenderer.Props, "relationFocusNodeIdRef">;

const FlowEdgeCullPaddingPx = 64;
const FlowSearchZoom = 1;
const DefaultOriginFlowViewportZoom = readDefaultOriginFlowViewportFn().zoom;

/** Owns the imperative Canvas painter, viewport, animation frame, and browser lifecycle. */
export const useCanvasRenderer = ({
	backbones,
	connectedPorts,
	edgeBounds,
	fitContent,
	focusNodeId,
	flow,
	highlight,
	highlightedEdgeColors,
	highlightedPortColors,
	metroBackbones,
	nodeMetrics,
	positions,
	relationFocusNodeIdRef,
	resourceUrls,
	selection,
}: useCanvasRenderer.Props): useCanvasRenderer.Output => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const scheduleDrawRef = useRef<() => void>(() => undefined);
	const drawItemArtworkFn = useCanvasArtworkPainter(scheduleDrawRef);
	const drawItemNodeFn = useCanvasItemNodePainter(drawItemArtworkFn);
	const readCanvasPaletteFn = useCanvasPalette(scheduleDrawRef);
	const routePainter = useCanvasRoutePainter();
	const viewportRef = useRef<Viewport>(readDefaultOriginFlowViewportFn());
	const frameRef = useRef<number | undefined>(undefined);
	const resetViewportRef = useRef(true);
	const renderStateRef = useRef<RenderState>({
		backbones,
		connectedPorts,
		edgeBounds,
		fitContent,
		focusNodeId,
		flow,
		highlight,
		highlightedEdgeColors,
		highlightedPortColors,
		metroBackbones,
		nodeMetrics,
		positions,
		resourceUrls,
		selection,
	});
	renderStateRef.current = {
		backbones,
		connectedPorts,
		edgeBounds,
		fitContent,
		focusNodeId,
		flow,
		highlight,
		highlightedEdgeColors,
		highlightedPortColors,
		metroBackbones,
		nodeMetrics,
		positions,
		resourceUrls,
		selection,
	};

	const drawFn = useCallback(() => {
		frameRef.current = undefined;
		const canvas = canvasRef.current;
		if (canvas === null) return;
		const context = canvas.getContext("2d");
		if (context === null) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const dpr = Math.max(1, window.devicePixelRatio || 1);
		const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
		const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
		if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
			canvas.width = pixelWidth;
			canvas.height = pixelHeight;
		}
		const state = renderStateRef.current;
		if (resetViewportRef.current) {
			const explicitFocusPosition =
				state.focusNodeId === undefined
					? undefined
					: state.positions.get(state.focusNodeId);
			const initialPosition = readOriginFlowInitialFocusFn(state.flow, state.positions);
			viewportRef.current =
				explicitFocusPosition !== undefined
					? readOriginFlowNodeViewportFn(
							explicitFocusPosition,
							rect.width,
							rect.height,
							FlowSearchZoom,
						)
					: state.fitContent
						? readOriginFlowFitViewportFn(state.positions, rect.width, rect.height)
						: initialPosition === undefined
							? readDefaultOriginFlowViewportFn()
							: readOriginFlowNodeViewportFn(
									initialPosition,
									rect.width,
									rect.height,
									DefaultOriginFlowViewportZoom,
								);
			resetViewportRef.current = false;
		}
		const viewport = viewportRef.current;
		const visibleNodes = readOriginFlowVisibleBoundsFn(viewport, rect.width, rect.height);
		const visibleEdges = readOriginFlowVisibleBoundsFn(
			viewport,
			rect.width,
			rect.height,
			FlowEdgeCullPaddingPx,
		);
		const palette = readCanvasPaletteFn(canvas);
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, rect.width, rect.height);
		routePainter.drawGridFn(context, rect.width, rect.height, viewport, palette);

		context.save();
		context.translate(viewport.x, viewport.y);
		context.scale(viewport.zoom, viewport.zoom);
		for (const highlighted of [
			false,
			true,
		]) {
			for (const edge of state.flow.edges) {
				const highlightColor = state.highlightedEdgeColors.get(edge.id);
				if ((highlightColor !== undefined) !== highlighted) continue;
				const routedBackbone = state.backbones.get(edge.id);
				if (routedBackbone === undefined)
					throw new Error(`Missing routed backbone for ${edge.id}.`);
				const backbone =
					highlightColor === undefined
						? routedBackbone
						: (state.metroBackbones.get(edge.id) ?? routedBackbone);
				const bounds = state.edgeBounds.get(edge.id);
				if (bounds === undefined) throw new Error(`Missing edge bounds for ${edge.id}.`);
				if (!isOriginFlowEdgeVisibleFn(bounds, visibleEdges)) continue;
				routePainter.drawEdgeFn(
					context,
					backbone,
					highlightColor,
					readCanvasEdgeOpacityFn(edge.id, highlighted, state.selection, state.highlight),
					palette,
				);
			}
		}
		for (const node of state.flow.nodes) {
			const position = state.positions.get(node.id);
			if (position === undefined) throw new Error(`Missing layout for ${node.id}.`);
			if (!isOriginFlowNodeVisibleFn(position, visibleNodes)) continue;
			const metrics = state.nodeMetrics.get(node.id);
			if (metrics === undefined) throw new Error(`Missing node metrics for ${node.id}.`);
			const nodeHighlight = readCanvasNodeHighlightFn(
				node,
				state.selection,
				state.highlight,
				relationFocusNodeIdRef.current,
			);
			drawItemNodeFn({
				connectedPortIds: state.connectedPorts.get(node.id),
				context,
				highlight: nodeHighlight,
				highlightedPortColors: state.highlightedPortColors.get(node.id),
				metrics,
				node,
				opacity: readCanvasNodeOpacityFn(
					node.id,
					state.selection,
					state.highlight,
					relationFocusNodeIdRef.current,
				),
				palette,
				position,
				resourceUrls: state.resourceUrls,
			});
		}
		context.restore();
	}, [
		drawItemNodeFn,
		readCanvasPaletteFn,
		relationFocusNodeIdRef,
		routePainter,
	]);

	const scheduleDrawFn = useCallback(() => {
		if (frameRef.current !== undefined) return;
		frameRef.current = requestAnimationFrame(drawFn);
	}, [
		drawFn,
	]);
	scheduleDrawRef.current = scheduleDrawFn;

	const focusNodeFn = useCallback(
		(nodeId: string) => {
			const canvas = canvasRef.current;
			const position = positions.get(nodeId);
			if (canvas === null || position === undefined) return false;
			const rect = canvas.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return false;
			viewportRef.current = readOriginFlowNodeViewportFn(
				position,
				rect.width,
				rect.height,
				FlowSearchZoom,
			);
			resetViewportRef.current = false;
			scheduleDrawFn();
			return true;
		},
		[
			positions,
			scheduleDrawFn,
		],
	);

	useLayoutEffect(() => {
		resetViewportRef.current = true;
		scheduleDrawFn();
	}, [
		fitContent,
		positions,
		scheduleDrawFn,
	]);

	useEffect(() => {
		scheduleDrawFn();
	}, [
		backbones,
		connectedPorts,
		edgeBounds,
		flow,
		highlight,
		highlightedEdgeColors,
		highlightedPortColors,
		metroBackbones,
		nodeMetrics,
		resourceUrls,
		scheduleDrawFn,
		selection,
	]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas === null) return;
		const observer = new ResizeObserver(() => scheduleDrawFn());
		observer.observe(canvas);
		return () => observer.disconnect();
	}, [
		scheduleDrawFn,
	]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas === null) return;
		const handleWheelFn = (event: WheelEvent) => {
			event.preventDefault();
			const rect = canvas.getBoundingClientRect();
			const pointerX = event.clientX - rect.left;
			const pointerY = event.clientY - rect.top;
			const current = viewportRef.current;
			const zoom = clampOriginFlowViewportZoomFn(
				current.zoom * Math.exp(-event.deltaY * 0.0015),
			);
			if (zoom === current.zoom) return;
			const worldX = (pointerX - current.x) / current.zoom;
			const worldY = (pointerY - current.y) / current.zoom;
			viewportRef.current = {
				x: pointerX - worldX * zoom,
				y: pointerY - worldY * zoom,
				zoom,
			};
			scheduleDrawFn();
		};
		canvas.addEventListener("wheel", handleWheelFn, {
			passive: false,
		});
		return () => canvas.removeEventListener("wheel", handleWheelFn);
	}, [
		scheduleDrawFn,
	]);

	useEffect(
		() => () => {
			if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
		},
		[],
	);

	return {
		canvasRef,
		focusNodeFn,
		scheduleDrawFn,
		viewportRef,
	};
};

export namespace useCanvasRenderer {
	export interface Props {
		readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly connectedPorts: ConnectedPorts;
		readonly edgeBounds: ReadonlyMap<string, Bounds>;
		readonly fitContent: boolean;
		readonly focusNodeId: string | undefined;
		readonly flow: ItemOriginFlow;
		readonly highlight: Highlight | undefined;
		readonly highlightedEdgeColors: ReadonlyMap<string, string>;
		readonly highlightedPortColors: ReadonlyMap<string, ReadonlyMap<string, string>>;
		readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
		readonly nodeMetrics: ReadonlyMap<string, NodeMetrics>;
		readonly positions: ReadonlyMap<string, LayoutNode>;
		readonly relationFocusNodeIdRef: RefObject<string | undefined>;
		readonly resourceUrls: ReadonlyMap<string, string>;
		readonly selection: Selection | undefined;
	}

	export interface Output {
		readonly canvasRef: RefObject<HTMLCanvasElement | null>;
		readonly focusNodeFn: (nodeId: string) => boolean;
		readonly scheduleDrawFn: () => void;
		readonly viewportRef: RefObject<Viewport>;
	}
}
