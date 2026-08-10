import { Effect } from "effect";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type PointerEvent as ReactPointerEvent,
} from "react";

import { type EditorItemOriginFlow } from "~/bridge/item/editor/readEditorItemOriginFlowFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import {
	createEditorOriginFlowCanvasPainterFx,
	type EditorOriginFlowCanvasPalette,
} from "~/ui/item/editor/createEditorOriginFlowCanvasPainterFx";
import {
	createEditorOriginFlowViewportFx,
	type EditorOriginFlowBounds as Bounds,
	type EditorOriginFlowViewport as Viewport,
} from "~/ui/item/editor/createEditorOriginFlowViewportFx";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/editorItemOriginFlowLayout";
import {
	type EditorOriginFlowDirection,
	type EditorOriginFlowHighlight,
	type EditorOriginFlowSelection,
} from "~/ui/item/editor/readEditorOriginFlowHighlightFx";
import { EditorOriginFlowShortcutHelp } from "~/ui/item/editor/EditorOriginFlowShortcutHelp";
import {
	type EditorOriginFlowConnectedPorts,
	readEditorOriginFlowConnectedPortsFx,
} from "~/ui/item/editor/readEditorOriginFlowConnectedPortsFx";
import {
	type EditorOriginFlowNodeMetrics,
	readEditorOriginFlowNodeMetricsFx,
} from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";
import { pushEditorOriginFlowVisitFx } from "~/ui/item/editor/pushEditorOriginFlowVisitFx";
import { readEditorOriginFlowHitFx } from "~/ui/item/editor/readEditorOriginFlowHitFx";
import { useEditorOriginFlowProjection } from "~/ui/item/editor/useEditorOriginFlowProjection";
import { useEditorOriginFlowNavigation } from "~/ui/item/editor/useEditorOriginFlowNavigation";
import { useEditorResourceUrls } from "~/ui/resource/editor/useEditorResourceUrl";

interface PanState {
	moved: boolean;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startViewport: Viewport;
}

interface EditorOriginFlowCanvasProps {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly direction?: EditorOriginFlowDirection;
	readonly fitContent: boolean;
	readonly flow: EditorItemOriginFlow;
	readonly focusNodeId?: string;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly selection: EditorOriginFlowSelection | undefined;
	readonly onSelectionChange: (selection: EditorOriginFlowSelection | undefined) => void;
}

interface RenderState {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly connectedPorts: EditorOriginFlowConnectedPorts;
	readonly fitContent: boolean;
	readonly focusNodeId?: string;
	readonly flow: EditorItemOriginFlow;
	readonly highlight: EditorOriginFlowHighlight | undefined;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly nodeMetrics: ReadonlyMap<string, EditorOriginFlowNodeMetrics>;
	readonly resourceUrls: ReadonlyMap<string, string>;
	readonly edgeBounds: ReadonlyMap<string, Bounds>;
	readonly highlightedEdgeColors: ReadonlyMap<string, string>;
	readonly highlightedPortColors: ReadonlyMap<string, ReadonlyMap<string, string>>;
	readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly selection: EditorOriginFlowSelection | undefined;
}

const FlowViewport = RendererRuntime.runSync(createEditorOriginFlowViewportFx());
const FlowPainter = RendererRuntime.runSync(createEditorOriginFlowCanvasPainterFx());
const ClickThreshold = 5;

/** Renders the passive item flow directly to Canvas with imperative pan and zoom. */
export const EditorOriginFlowCanvas = ({
	backbones,
	direction = "income",
	fitContent,
	flow,
	focusNodeId,
	onSelectionChange,
	positions,
	selection,
}: EditorOriginFlowCanvasProps) => {
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
		() => FlowViewport.readBackboneBounds(backbones),
		[
			backbones,
		],
	);
	const connectedPorts = useMemo(
		() => RendererRuntime.runSync(readEditorOriginFlowConnectedPortsFx(flow.edges)),
		[
			flow.edges,
		],
	);
	const nodeMetrics = useMemo(
		() =>
			new Map(
				RendererRuntime.runSync(
					Effect.forEach(flow.nodes, (node) =>
						Effect.map(
							readEditorOriginFlowNodeMetricsFx(node),
							(metrics) =>
								[
									node.id,
									metrics,
								] as const,
						),
					),
				),
			),
		[
			flow.nodes,
		],
	);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
	const scheduleDrawRef = useRef<() => void>(() => undefined);
	const viewportRef = useRef<Viewport>(FlowViewport.defaultViewport);
	const panRef = useRef<PanState | undefined>(undefined);
	const frameRef = useRef<number | undefined>(undefined);
	const resetViewportRef = useRef(true);
	const paletteRef = useRef<EditorOriginFlowCanvasPalette | undefined>(undefined);
	const {
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
	} = useEditorOriginFlowProjection({
		backbones,
		direction,
		flow,
		positions,
		selection,
	});
	const renderStateRef = useRef<RenderState>({
		backbones,
		connectedPorts,
		fitContent,
		flow,
		focusNodeId,
		highlight,
		positions,
		nodeMetrics,
		resourceUrls,
		edgeBounds,
		highlightedEdgeColors,
		highlightedPortColors,
		metroBackbones,
		selection,
	});
	renderStateRef.current = {
		backbones,
		connectedPorts,
		fitContent,
		flow,
		focusNodeId,
		highlight,
		positions,
		nodeMetrics,
		resourceUrls,
		edgeBounds,
		highlightedEdgeColors,
		highlightedPortColors,
		metroBackbones,
		selection,
	};

	const draw = useCallback(() => {
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
			const initialPosition = FlowViewport.readInitialFocus(state.flow, state.positions);
			viewportRef.current =
				explicitFocusPosition !== undefined
					? FlowViewport.readNode(
							explicitFocusPosition,
							rect.width,
							rect.height,
							FlowViewport.searchFocusZoom,
						)
					: state.fitContent
						? FlowViewport.readFit(state.positions, rect.width, rect.height)
						: initialPosition === undefined
							? FlowViewport.defaultViewport
							: FlowViewport.readNode(
									initialPosition,
									rect.width,
									rect.height,
									FlowViewport.defaultViewport.zoom,
								);
			resetViewportRef.current = false;
		}
		const viewport = viewportRef.current;
		const visibleNodes = FlowViewport.readVisibleBounds(viewport, rect.width, rect.height);
		const visibleEdges = FlowViewport.readVisibleBounds(
			viewport,
			rect.width,
			rect.height,
			FlowViewport.edgeCullPaddingPx,
		);
		const palette = paletteRef.current ?? FlowPainter.readPalette(canvas);
		paletteRef.current = palette;
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, rect.width, rect.height);
		FlowPainter.drawGrid(context, rect.width, rect.height, viewport, palette);

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
				if (!FlowViewport.isEdgeVisible(bounds, visibleEdges)) continue;
				FlowPainter.drawEdge(
					context,
					backbone,
					highlightColor,
					FlowPainter.readEdgeOpacity(
						edge.id,
						highlighted,
						state.selection,
						state.highlight,
					),
					palette,
				);
			}
		}
		for (const node of state.flow.nodes) {
			const position = state.positions.get(node.id);
			if (position === undefined) throw new Error(`Missing layout for ${node.id}.`);
			if (!FlowViewport.isNodeVisible(position, visibleNodes)) continue;
			const metrics = state.nodeMetrics.get(node.id);
			if (metrics === undefined) throw new Error(`Missing node metrics for ${node.id}.`);
			const nodeHighlight = FlowPainter.readNodeHighlight(
				node,
				state.selection,
				state.highlight,
				relationNavigationFocusNodeIdRef.current,
			);
			FlowPainter.drawItemNode(
				context,
				node,
				position,
				metrics,
				nodeHighlight,
				FlowPainter.readNodeOpacity(
					node.id,
					state.selection,
					state.highlight,
					relationNavigationFocusNodeIdRef.current,
				),
				palette,
				state.resourceUrls,
				imageCacheRef.current,
				scheduleDrawRef.current,
				state.connectedPorts.get(node.id),
				state.highlightedPortColors.get(node.id),
			);
		}
		context.restore();
	}, []);

	const scheduleDraw = useCallback(() => {
		if (frameRef.current !== undefined) return;
		frameRef.current = requestAnimationFrame(draw);
	}, [
		draw,
	]);
	scheduleDrawRef.current = scheduleDraw;
	const {
		helpOpen,
		relationFocusNodeIdRef: relationNavigationFocusNodeIdRef,
		resetNavigation,
		setHelpOpen,
		visitHistoryRef,
	} = useEditorOriginFlowNavigation({
		canvasRef,
		direction,
		flow,
		inputNodeIds: inputNavigationNodeIds,
		maxHighlightLevel,
		navigationNodeIds,
		onSelectionChange,
		outputNodeIds: outputNavigationNodeIds,
		positions,
		rootNodeIds: rootNavigationNodeIds,
		scheduleDraw,
		selection,
		setHighlightDepth,
		viewport: FlowViewport,
		viewportRef,
	});

	useLayoutEffect(() => {
		resetViewportRef.current = true;
		scheduleDraw();
	}, [
		fitContent,
		positions,
		scheduleDraw,
	]);

	useEffect(() => {
		if (focusNodeId === undefined) return;
		const canvas = canvasRef.current;
		const position = positions.get(focusNodeId);
		if (canvas === null || position === undefined) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		viewportRef.current = FlowViewport.readNode(
			position,
			rect.width,
			rect.height,
			FlowViewport.searchFocusZoom,
		);
		resetNavigation();
		resetViewportRef.current = false;
		scheduleDraw();
	}, [
		focusNodeId,
		positions,
		resetNavigation,
		scheduleDraw,
	]);

	useEffect(() => {
		scheduleDraw();
	}, [
		connectedPorts,
		flow,
		highlight,
		nodeMetrics,
		resourceUrls,
		scheduleDraw,
		selection,
	]);

	useEffect(() => {
		const refreshPalette = () => {
			paletteRef.current = undefined;
			scheduleDraw();
		};
		const observer = new MutationObserver(refreshPalette);
		observer.observe(document.documentElement, {
			attributeFilter: [
				"data-accent",
				"data-theme",
			],
			attributes: true,
		});
		const scheme = matchMedia("(prefers-color-scheme: dark)");
		scheme.addEventListener("change", refreshPalette);
		return () => {
			observer.disconnect();
			scheme.removeEventListener("change", refreshPalette);
		};
	}, [
		scheduleDraw,
	]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas === null) return;
		const observer = new ResizeObserver(() => scheduleDraw());
		observer.observe(canvas);
		return () => observer.disconnect();
	}, [
		scheduleDraw,
	]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas === null) return;
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault();
			const rect = canvas.getBoundingClientRect();
			const pointerX = event.clientX - rect.left;
			const pointerY = event.clientY - rect.top;
			const current = viewportRef.current;
			const zoom = FlowViewport.clampZoom(current.zoom * Math.exp(-event.deltaY * 0.0015));
			if (zoom === current.zoom) return;
			const worldX = (pointerX - current.x) / current.zoom;
			const worldY = (pointerY - current.y) / current.zoom;
			viewportRef.current = {
				x: pointerX - worldX * zoom,
				y: pointerY - worldY * zoom,
				zoom,
			};
			scheduleDraw();
		};
		canvas.addEventListener("wheel", handleWheel, {
			passive: false,
		});
		return () => canvas.removeEventListener("wheel", handleWheel);
	}, [
		scheduleDraw,
	]);

	useEffect(
		() => () => {
			if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
			for (const image of imageCacheRef.current.values()) image.src = "";
			imageCacheRef.current.clear();
		},
		[],
	);

	const finishPan = (event: ReactPointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
		const pan = panRef.current;
		if (pan === undefined || pan.pointerId !== event.pointerId) return;
		panRef.current = undefined;
		event.currentTarget.style.cursor = "grab";
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		if (cancelled || pan.moved) return;

		const rect = event.currentTarget.getBoundingClientRect();
		const viewport = viewportRef.current;
		const worldX = (event.clientX - rect.left - viewport.x) / viewport.zoom;
		const worldY = (event.clientY - rect.top - viewport.y) / viewport.zoom;
		const hit = RendererRuntime.runSync(
			readEditorOriginFlowHitFx({
				backbones,
				connectedPorts,
				flow,
				highlight,
				metroBackbones,
				nodeMetrics,
				positions,
				selection,
				x: worldX,
				y: worldY,
				zoom: viewport.zoom,
			}),
		);
		if (hit?.kind === "port") {
			const targetPosition = positions.get(hit.targetNodeId);
			if (targetPosition === undefined) return;
			viewportRef.current = FlowViewport.readNode(
				targetPosition,
				rect.width,
				rect.height,
				Math.max(viewport.zoom, FlowViewport.defaultViewport.zoom),
			);
			resetNavigation();
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node")
				visitHistory = RendererRuntime.runSync(
					pushEditorOriginFlowVisitFx(visitHistory, selection.id),
				);
			visitHistoryRef.current = RendererRuntime.runSync(
				pushEditorOriginFlowVisitFx(visitHistory, hit.targetNodeId),
			);
			onSelectionChange({
				id: hit.targetNodeId,
				kind: "node",
			});
			scheduleDraw();
			return;
		}
		if (hit?.kind === "node") {
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node")
				visitHistory = RendererRuntime.runSync(
					pushEditorOriginFlowVisitFx(visitHistory, selection.id),
				);
			visitHistoryRef.current = RendererRuntime.runSync(
				pushEditorOriginFlowVisitFx(visitHistory, hit.id),
			);
		}
		if (
			hit !== undefined &&
			selection !== undefined &&
			hit.kind === selection.kind &&
			hit.id === selection.id
		)
			onSelectionChange(undefined);
		else onSelectionChange(hit);
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (event.button !== 0) return;
		panRef.current = {
			moved: false,
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startViewport: viewportRef.current,
		};
		event.currentTarget.style.cursor = "grabbing";
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const pan = panRef.current;
		if (pan === undefined || pan.pointerId !== event.pointerId) return;
		const deltaX = event.clientX - pan.startClientX;
		const deltaY = event.clientY - pan.startClientY;
		if (Math.abs(deltaX) + Math.abs(deltaY) >= ClickThreshold) pan.moved = true;
		viewportRef.current = {
			x: pan.startViewport.x + deltaX,
			y: pan.startViewport.y + deltaY,
			zoom: pan.startViewport.zoom,
		};
		scheduleDraw();
	};

	return (
		<>
			<canvas
				aria-label="Item flow"
				className="block size-full touch-none cursor-grab text-foreground"
				data-ui="EditorOriginFlowCanvas"
				onPointerCancel={(event) => finishPan(event, true)}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={(event) => finishPan(event, false)}
				ref={canvasRef}
			/>
			{helpOpen ? (
				<EditorOriginFlowShortcutHelp
					direction={direction}
					onClose={() => setHelpOpen(false)}
				/>
			) : null}
		</>
	);
};
