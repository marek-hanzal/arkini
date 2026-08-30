import { X } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { type EditorItemOriginFlow } from "~/flow/type/EditorItemOriginFlow";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { CanvasPalette } from "~/flow-canvas/type/CanvasPalette";
import { createCanvasPainterFx } from "~/flow-canvas/fx/createCanvasPainterFx";
import {
	clampOriginFlowViewportZoomFn,
	isOriginFlowEdgeVisibleFn,
	isOriginFlowNodeVisibleFn,
	readDefaultOriginFlowViewportFn,
	readOriginFlowBackboneBoundsFn,
	readOriginFlowFitViewportFn,
	readOriginFlowInitialFocusFn,
	readOriginFlowNodeViewportFn,
	readOriginFlowVisibleBoundsFn,
} from "~/flow-canvas/fn/readOriginFlowViewportFn";
import type { Bounds, Viewport } from "~/flow-canvas/type/Viewport";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";
import {
	type OriginFlowDirection,
	type Highlight,
	type Selection,
} from "~/flow-canvas/type/Highlight";
import { type ConnectedPorts, readConnectedPortsFn } from "~/flow-canvas/fn/readConnectedPortsFn";
import { type NodeMetrics, readNodeMetricsFn } from "~/flow-layout/fn/readNodeMetricsFn";
import { useCanvasPointer } from "~/flow-canvas/ui/useCanvasPointer";
import { useProjection } from "~/flow-canvas/ui/useProjection";
import { useNavigation } from "~/flow-canvas/ui/useNavigation";
import { useEditorResourceUrls } from "~/asset-authoring/ui/EditorResourceUrlSession";
import { useOverlayFocus } from "~/ui/focus/useOverlayFocus";
import { ItemTypeLabel } from "~/item-definition/ui/ItemDefinitionLabels";

interface ShortcutHelpProps {
	readonly direction: OriginFlowDirection;
	readonly onClose: () => void;
}

const readShortcutRows = (direction: OriginFlowDirection) =>
	[
		[
			"N",
			`Next item in the selected ${direction === "output" ? "Output" : "Input"} graph.`,
		],
		[
			"P",
			`Previous item in the selected ${direction === "output" ? "Output" : "Input"} graph.`,
		],
		[
			"H",
			"Return to the selected item, or the graph start when nothing is selected.",
		],
		[
			"K",
			"Hide the farthest visible level of the selected graph.",
		],
		[
			"L",
			"Show one more hidden level of the selected graph.",
		],
		[
			"0",
			"Restore the default one-level view and return to the selected item.",
		],
		[
			"S",
			"Cycle terminal/root items of the selected graph to verify where the chain starts or ends.",
		],
		[
			"I",
			"Cycle through items whose operations use the selected item as an input.",
		],
		[
			"O",
			"Cycle through items whose operations output the selected item.",
		],
		[
			"Z",
			"Go back through recently clicked items.",
		],
		[
			"?",
			"Open or close this help.",
		],
	] as const;

/** Explains the keyboard navigation available on the Game Flow canvas. */
const ShortcutHelp = ({ direction, onClose }: ShortcutHelpProps) => {
	const { onKeyDown, overlayRef } = useOverlayFocus({
		onClose,
	});
	return (
		<div
			className="absolute inset-0 z-20 grid place-items-center bg-black/20 p-6 backdrop-blur-[1px]"
			data-ui="EditorOriginFlowShortcutHelp"
			onKeyDown={onKeyDown}
			onPointerDown={(event) => {
				if (event.currentTarget === event.target) onClose();
			}}
			ref={overlayRef}
		>
			<div className="w-full max-w-lg rounded-lg border border-line bg-surface-raised p-5 shadow-xl">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold">Flow shortcuts</h2>
						<p className="mt-1 text-sm text-muted">
							Shortcuts follow the currently selected item.
						</p>
					</div>
					<button
						className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-muted hover:bg-surface hover:text-foreground"
						onClick={onClose}
						type="button"
					>
						<X className="size-4" />
					</button>
				</div>
				<div className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
					{readShortcutRows(direction).map(([key, description]) => (
						<Fragment key={key}>
							<kbd className="min-w-8 rounded border border-line bg-surface px-2 py-1 text-center font-mono font-semibold">
								{key}
							</kbd>
							<span>{description}</span>
						</Fragment>
					))}
				</div>
				<p className="mt-5 text-xs text-muted">
					Keyboard shortcuts stay inactive while typing in a field. Press Esc to close
					help.
				</p>
			</div>
		</div>
	);
};

interface CanvasProps {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly direction?: OriginFlowDirection;
	readonly fitContent: boolean;
	readonly flow: EditorItemOriginFlow;
	readonly focusNodeId?: string;
	readonly focusRequestKey?: number;
	readonly positions: ReadonlyMap<string, LayoutNode>;
	readonly selection: Selection | undefined;
	readonly onSelectionChange: (selection: Selection | undefined) => void;
	readonly onItemOpen: (itemId: string) => void;
}

interface RenderState {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly connectedPorts: ConnectedPorts;
	readonly fitContent: boolean;
	readonly focusNodeId?: string;
	readonly flow: EditorItemOriginFlow;
	readonly highlight: Highlight | undefined;
	readonly positions: ReadonlyMap<string, LayoutNode>;
	readonly nodeMetrics: ReadonlyMap<string, NodeMetrics>;
	readonly resourceUrls: ReadonlyMap<string, string>;
	readonly edgeBounds: ReadonlyMap<string, Bounds>;
	readonly highlightedEdgeColors: ReadonlyMap<string, string>;
	readonly highlightedPortColors: ReadonlyMap<string, ReadonlyMap<string, string>>;
	readonly metroBackbones: ReadonlyMap<string, ReadonlyArray<LayoutPoint>>;
	readonly selection: Selection | undefined;
}

const FlowEdgeCullPaddingPx = 64;
const FlowSearchZoom = 1;
const DefaultOriginFlowViewportZoom = readDefaultOriginFlowViewportFn().zoom;
const FlowPainter = RendererRuntime.runSync(
	createCanvasPainterFx({
		itemTypeLabels: ItemTypeLabel,
	}),
);

/** Renders the passive item flow directly to Canvas with imperative pan and zoom. */
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
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
	const scheduleDrawRef = useRef<() => void>(() => undefined);
	const viewportRef = useRef<Viewport>(readDefaultOriginFlowViewportFn());
	const relationNavigationFocusNodeIdRef = useRef<string | undefined>(undefined);
	const frameRef = useRef<number | undefined>(undefined);
	const resetViewportRef = useRef(true);
	const paletteRef = useRef<CanvasPalette | undefined>(undefined);
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
	} = useProjection({
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
				if (!isOriginFlowEdgeVisibleFn(bounds, visibleEdges)) continue;
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
			if (!isOriginFlowNodeVisibleFn(position, visibleNodes)) continue;
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
	const { helpOpen, resetNavigation, setHelpOpen, visitHistoryRef } = useNavigation({
		canvasRef,
		direction,
		flow,
		inputNodeIds: inputNavigationNodeIds,
		maxHighlightLevel,
		navigationNodeIds,
		onSelectionChange,
		outputNodeIds: outputNavigationNodeIds,
		positions,
		relationFocusNodeIdRef: relationNavigationFocusNodeIdRef,
		rootNodeIds: rootNavigationNodeIds,
		scheduleDraw,
		selection,
		setHighlightDepth,
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
		viewportRef.current = readOriginFlowNodeViewportFn(
			position,
			rect.width,
			rect.height,
			FlowSearchZoom,
		);
		resetNavigation();
		resetViewportRef.current = false;
		scheduleDraw();
	}, [
		focusNodeId,
		focusRequestKey,
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

	const { handlePointerCancel, handlePointerDown, handlePointerMove, handlePointerUp } =
		useCanvasPointer({
			backbones,
			connectedPorts,
			flow,
			highlight,
			metroBackbones,
			nodeMetrics,
			onItemOpen,
			onSelectionChange,
			positions,
			resetNavigation,
			scheduleDraw,
			selection,
			viewportRef,
			visitHistoryRef,
		});

	return (
		<>
			<canvas
				className="block size-full touch-none cursor-grab text-foreground"
				data-ui="EditorOriginFlowCanvas"
				onPointerCancel={handlePointerCancel}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				ref={canvasRef}
			/>
			{helpOpen ? (
				<ShortcutHelp
					direction={direction}
					onClose={() => setHelpOpen(false)}
				/>
			) : null}
		</>
	);
};
