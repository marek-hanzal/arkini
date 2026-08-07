import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type PointerEvent as ReactPointerEvent,
} from "react";

import type {
	EditorItemOriginEdge,
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
	EditorItemOriginNode,
	EditorItemOriginSourceNode,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import { ItemTypeLabel } from "~/ui/item-detail/ItemInfoPresentation";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/layoutEditorItemOriginFlow";
import {
	type EditorOriginFlowSelection,
	readEditorOriginFlowHighlight,
} from "~/ui/item/editor/readEditorOriginFlowHighlight";
import { useEditorResourceUrls } from "~/ui/resource/editor/useEditorResourceUrl";

interface Viewport {
	x: number;
	y: number;
	zoom: number;
}

interface PanState {
	moved: boolean;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startViewport: Viewport;
}

interface EditorOriginFlowCanvasProps {
	readonly fitContent: boolean;
	readonly flow: EditorItemOriginFlow;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly selection: EditorOriginFlowSelection | undefined;
	readonly onSelectionChange: (selection: EditorOriginFlowSelection | undefined) => void;
}

interface RenderState {
	readonly fitContent: boolean;
	readonly flow: EditorItemOriginFlow;
	readonly highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly resourceUrls: ReadonlyMap<string, string>;
	readonly routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly selection: EditorOriginFlowSelection | undefined;
}

const DefaultViewport: Viewport = {
	x: 24,
	y: 24,
	zoom: 0.75,
};
const MinZoom = 0.2;
const MaxZoom = 1.4;
const FitPaddingRatio = 0.12;
const ClickThreshold = 5;
const EdgeHitRadiusPx = 9;
const MaxCachedImages = 96;

interface CanvasPalette {
	readonly accent: string;
	readonly danger: string;
	readonly foreground: string;
	readonly info: string;
	readonly itemSurfaces: Readonly<Record<EditorItemOriginItemNode["type"], string>>;
	readonly line: string;
	readonly lineStrong: string;
	readonly muted: string;
	readonly sourceSurfaces: Readonly<Record<EditorItemOriginSourceNode["sourceKind"], string>>;
	readonly success: string;
	readonly warning: string;
}

const readCanvasPalette = (host: HTMLElement): CanvasPalette => {
	const probe = document.createElement("span");
	probe.style.display = "none";
	(host.parentElement ?? document.body).append(probe);
	try {
		const read = (property: string) => {
			probe.style.color = `var(${property})`;
			return getComputedStyle(probe).color;
		};
		return {
			accent: read("--ak-accent"),
			danger: read("--ak-danger"),
			foreground: read("--ak-foreground"),
			info: read("--ak-info"),
			itemSurfaces: {
				blueprint: read("--ak-flow-item-blueprint-surface"),
				craft: read("--ak-flow-item-craft-surface"),
				deposit: read("--ak-flow-item-deposit-surface"),
				inventory: read("--ak-flow-item-inventory-surface"),
				missing: read("--ak-flow-item-missing-surface"),
				producer: read("--ak-flow-item-producer-surface"),
				simple: read("--ak-flow-item-simple-surface"),
				stash: read("--ak-flow-item-stash-surface"),
				temporary: read("--ak-flow-item-temporary-surface"),
			},
			line: read("--ak-line"),
			lineStrong: read("--ak-line-strong"),
			muted: read("--ak-muted"),
			sourceSurfaces: {
				charges: read("--ak-flow-source-charges-surface"),
				expiry: read("--ak-flow-source-expiry-surface"),
				line: read("--ak-flow-source-line-surface"),
				merge: read("--ak-flow-source-merge-surface"),
			},
			success: read("--ak-success"),
			warning: read("--ak-warning"),
		};
	} finally {
		probe.remove();
	}
};

const readItemTypeColor = (palette: CanvasPalette, type: EditorItemOriginItemNode["type"]) => {
	switch (type) {
		case "blueprint":
		case "producer":
			return palette.accent;
		case "craft":
		case "deposit":
			return palette.warning;
		case "inventory":
		case "stash":
			return palette.info;
		case "missing":
		case "temporary":
			return palette.danger;
		case "simple":
			return palette.lineStrong;
	}
};

const readSourceKindColor = (
	palette: CanvasPalette,
	kind: EditorItemOriginSourceNode["sourceKind"],
) => {
	switch (kind) {
		case "line":
			return palette.accent;
		case "charges":
			return palette.warning;
		case "merge":
			return palette.success;
		case "expiry":
			return palette.danger;
	}
};

const SourceKindLabel: Record<EditorItemOriginSourceNode["sourceKind"], string> = {
	line: "Production",
	charges: "Depletion",
	merge: "Merge",
	expiry: "Expiry",
};
const SelectionKindLabel: Record<EditorItemOriginSourceNode["selectionKind"], string> = {
	guaranteed: "Guaranteed",
	chance: "Chance",
	weighted: "Weighted",
	replace: "Replacement",
};

const SourceKindIconPath: Record<EditorItemOriginSourceNode["sourceKind"], string> = {
	line: "M12 16h.01M16 16h.01M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zm5-3h.01",
	charges:
		"m11 7-3 5h4l-3 5m5.856-11H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935M22 14v-4M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936",
	merge: "M14 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1m5-7a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1M7 15l3 3m-3 3 3-3H5a2 2 0 0 1-2-2v-2",
	expiry: "M10 2h4m-2 12 3-3",
};
const sourceIconPathCache = new Map<EditorItemOriginSourceNode["sourceKind"], Path2D>();

const clampZoom = (zoom: number) => Math.max(MinZoom, Math.min(MaxZoom, zoom));

const readFlowBounds = (positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>) => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const node of positions.values()) {
		minX = Math.min(minX, node.x);
		minY = Math.min(minY, node.y);
		maxX = Math.max(maxX, node.x + node.width);
		maxY = Math.max(maxY, node.y + node.height);
	}
	if (
		![
			minX,
			minY,
			maxX,
			maxY,
		].every(Number.isFinite)
	)
		return {
			maxX: 1,
			maxY: 1,
			minX: 0,
			minY: 0,
		};
	return {
		maxX,
		maxY,
		minX,
		minY,
	};
};

const readFitViewport = (
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	width: number,
	height: number,
): Viewport => {
	const bounds = readFlowBounds(positions);
	const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
	const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
	const availableWidth = Math.max(1, width * (1 - FitPaddingRatio * 2));
	const availableHeight = Math.max(1, height * (1 - FitPaddingRatio * 2));
	const zoom = clampZoom(
		Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
	);
	return {
		x: (width - contentWidth * zoom) / 2 - bounds.minX * zoom,
		y: (height - contentHeight * zoom) / 2 - bounds.minY * zoom,
		zoom,
	};
};

const isNodeVisible = (
	position: EditorItemOriginFlowLayoutNode,
	viewport: Viewport,
	width: number,
	height: number,
) => {
	const left = position.x * viewport.zoom + viewport.x;
	const top = position.y * viewport.zoom + viewport.y;
	const right = (position.x + position.width) * viewport.zoom + viewport.x;
	const bottom = (position.y + position.height) * viewport.zoom + viewport.y;
	return right >= 0 && bottom >= 0 && left <= width && top <= height;
};

const drawRoundedRect = (
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) => {
	context.beginPath();
	context.roundRect(x, y, width, height, radius);
};

const fitText = (context: CanvasRenderingContext2D, value: string, maxWidth: number) => {
	if (context.measureText(value).width <= maxWidth) return value;
	let end = value.length;
	while (end > 0) {
		const candidate = `${value.slice(0, end)}…`;
		if (context.measureText(candidate).width <= maxWidth) return candidate;
		end -= 1;
	}
	return "";
};

const drawNodeFrame = (
	context: CanvasRenderingContext2D,
	position: EditorItemOriginFlowLayoutNode,
	radius: number,
	background: string,
	idleBorder: string,
	highlight: "active" | "idle" | "selected",
	palette: CanvasPalette,
) => {
	if (radius === 0) {
		context.beginPath();
		context.rect(position.x, position.y, position.width, position.height);
	} else
		drawRoundedRect(context, position.x, position.y, position.width, position.height, radius);
	context.fillStyle = background;
	context.fill();
	context.lineWidth = highlight === "selected" ? 4 : highlight === "active" ? 2.5 : 2;
	context.strokeStyle = highlight === "idle" ? idleBorder : palette.accent;
	context.stroke();
};

const readReadyImage = (
	cache: Map<string, HTMLImageElement>,
	url: string | undefined,
	onReady: () => void,
) => {
	if (url === undefined) return undefined;
	const existing = cache.get(url);
	if (existing !== undefined) {
		cache.delete(url);
		cache.set(url, existing);
		return existing.complete && existing.naturalWidth > 0 ? existing : undefined;
	}
	const image = new Image();
	image.decoding = "async";
	image.onload = onReady;
	image.onerror = onReady;
	cache.set(url, image);
	while (cache.size > MaxCachedImages) {
		const oldestUrl = cache.keys().next().value;
		if (oldestUrl === undefined) break;
		const oldest = cache.get(oldestUrl);
		if (oldest !== undefined) oldest.src = "";
		cache.delete(oldestUrl);
	}
	image.src = url;
	return undefined;
};

const drawContainedImage = (
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number,
) => {
	const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
	const drawWidth = image.naturalWidth * scale;
	const drawHeight = image.naturalHeight * scale;
	context.drawImage(
		image,
		x + (width - drawWidth) / 2,
		y + (height - drawHeight) / 2,
		drawWidth,
		drawHeight,
	);
};

const drawItemArtwork = (
	context: CanvasRenderingContext2D,
	node: EditorItemOriginItemNode,
	resourceUrls: ReadonlyMap<string, string>,
	imageCache: Map<string, HTMLImageElement>,
	onImageReady: () => void,
	x: number,
	y: number,
	size: number,
	palette: CanvasPalette,
) => {
	const background = readReadyImage(
		imageCache,
		resourceUrls.get(node.resourceIds[0]),
		onImageReady,
	);
	const foreground = readReadyImage(
		imageCache,
		resourceUrls.get(node.resourceIds[1] ?? ""),
		onImageReady,
	);
	if (background === undefined) {
		context.fillStyle = palette.muted;
		context.font = "600 22px Inter, ui-sans-serif, system-ui, sans-serif";
		context.textAlign = "center";
		context.fillText("?", x + size / 2, y + size / 2 + 8);
		context.textAlign = "start";
		return;
	}
	if (foreground === undefined) {
		drawContainedImage(context, background, x, y, size, size);
		return;
	}
	const layerSize = size * 0.74;
	drawContainedImage(context, background, x, y, layerSize, layerSize);
	drawContainedImage(
		context,
		foreground,
		x + size - layerSize,
		y + size - layerSize,
		layerSize,
		layerSize,
	);
};

const drawItemNode = (
	context: CanvasRenderingContext2D,
	node: EditorItemOriginItemNode,
	position: EditorItemOriginFlowLayoutNode,
	highlight: "active" | "idle" | "selected",
	selectionActive: boolean,
	palette: CanvasPalette,
	resourceUrls: ReadonlyMap<string, string>,
	imageCache: Map<string, HTMLImageElement>,
	onImageReady: () => void,
) => {
	const typeColor = readItemTypeColor(palette, node.type);
	context.save();
	context.globalAlpha = selectionActive && highlight === "idle" ? 0.2 : 1;
	drawNodeFrame(
		context,
		position,
		0,
		palette.itemSurfaces[node.type],
		typeColor,
		highlight,
		palette,
	);

	const artworkSize = 52;
	const artworkX = position.x + 12;
	const artworkY = position.y + (position.height - artworkSize) / 2;
	drawItemArtwork(
		context,
		node,
		resourceUrls,
		imageCache,
		onImageReady,
		artworkX,
		artworkY,
		artworkSize,
		palette,
	);

	const textX = artworkX + artworkSize + 12;
	const maxTextWidth = position.x + position.width - 12 - textX;
	context.fillStyle = palette.foreground;
	context.font = "600 14px Inter, ui-sans-serif, system-ui, sans-serif";
	context.fillText(fitText(context, node.title, maxTextWidth), textX, position.y + 24);
	context.fillStyle = palette.muted;
	context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
	context.fillText(fitText(context, node.itemId, maxTextWidth), textX, position.y + 43);
	context.font = "600 10px Inter, ui-sans-serif, system-ui, sans-serif";
	const label =
		node.starterScopes.length > 0
			? `Starter: ${node.starterScopes.join(", ")}`
			: node.type === "missing"
				? "Missing item"
				: ItemTypeLabel[node.type];
	context.fillText(fitText(context, label.toUpperCase(), maxTextWidth), textX, position.y + 61);
	context.restore();
};

const drawSourceIcon = (
	context: CanvasRenderingContext2D,
	kind: EditorItemOriginSourceNode["sourceKind"],
	x: number,
	y: number,
	size: number,
	color: string,
) => {
	let path = sourceIconPathCache.get(kind);
	if (path === undefined) {
		path = new Path2D(SourceKindIconPath[kind]);
		sourceIconPathCache.set(kind, path);
	}
	context.save();
	context.translate(x, y);
	context.scale(size / 24, size / 24);
	context.strokeStyle = color;
	context.lineWidth = 2;
	context.lineCap = "round";
	context.lineJoin = "round";
	context.stroke(path);
	if (kind === "merge") {
		context.beginPath();
		context.roundRect(14, 14, 7, 7, 1);
		context.roundRect(3, 3, 7, 7, 1);
		context.stroke();
	} else if (kind === "expiry") {
		context.beginPath();
		context.arc(12, 14, 8, 0, Math.PI * 2);
		context.stroke();
	}
	context.restore();
};

const readSourceSummary = (node: EditorItemOriginSourceNode) =>
	[
		SourceKindLabel[node.sourceKind],
		node.weightedSet ? "Weighted set" : undefined,
		SelectionKindLabel[node.selectionKind],
		node.placement === "random"
			? "Random board"
			: node.placement === "drop"
				? "Local drop"
				: undefined,
	]
		.filter((value): value is string => value !== undefined)
		.join(" · ");

const drawSourceNode = (
	context: CanvasRenderingContext2D,
	node: EditorItemOriginSourceNode,
	position: EditorItemOriginFlowLayoutNode,
	highlight: "active" | "idle" | "selected",
	selectionActive: boolean,
	palette: CanvasPalette,
) => {
	const kindColor = readSourceKindColor(palette, node.sourceKind);
	context.save();
	context.globalAlpha = selectionActive && highlight === "idle" ? 0.2 : 1;
	drawNodeFrame(
		context,
		position,
		18,
		palette.sourceSurfaces[node.sourceKind],
		kindColor,
		highlight,
		palette,
	);

	const iconSize = 40;
	const iconX = position.x + 18;
	const iconY = position.y + (position.height - iconSize) / 2;
	drawSourceIcon(context, node.sourceKind, iconX, iconY, iconSize, kindColor);

	const textX = iconX + iconSize + 18;
	const maxTextWidth = position.x + position.width - 18 - textX;
	context.fillStyle = palette.foreground;
	context.font = "600 14px Inter, ui-sans-serif, system-ui, sans-serif";
	context.fillText(fitText(context, node.label, maxTextWidth), textX, position.y + 63);
	context.fillStyle = palette.muted;
	context.font = "600 11px Inter, ui-sans-serif, system-ui, sans-serif";
	const summary = readSourceSummary(node);
	context.fillText(fitText(context, summary, maxTextWidth), textX, position.y + 84);
	context.restore();
};

const drawArrow = (
	context: CanvasRenderingContext2D,
	from: EditorItemOriginFlowLayoutPoint,
	to: EditorItemOriginFlowLayoutPoint,
) => {
	const angle = Math.atan2(to.y - from.y, to.x - from.x);
	const length = 8;
	context.beginPath();
	context.moveTo(to.x, to.y);
	context.lineTo(
		to.x - Math.cos(angle - Math.PI / 6) * length,
		to.y - Math.sin(angle - Math.PI / 6) * length,
	);
	context.lineTo(
		to.x - Math.cos(angle + Math.PI / 6) * length,
		to.y - Math.sin(angle + Math.PI / 6) * length,
	);
	context.closePath();
	context.fill();
};

const drawEdge = (
	context: CanvasRenderingContext2D,
	edge: EditorItemOriginEdge,
	route: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	selection: EditorOriginFlowSelection | undefined,
	highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined,
	palette: CanvasPalette,
) => {
	if (route.length < 2) return;
	const selected = selection?.kind === "edge" && selection.id === edge.id;
	const active = highlight?.edgeIds.has(edge.id) ?? false;
	context.save();
	context.globalAlpha = selection === undefined ? 0.5 : active ? 1 : 0.1;
	context.strokeStyle = palette.accent;
	context.fillStyle = palette.accent;
	context.lineWidth = selected ? 5 : active ? 4 : 1.5;
	context.lineJoin = "round";
	context.lineCap = "round";
	context.beginPath();
	context.moveTo(route[0]!.x, route[0]!.y);
	for (const point of route.slice(1)) context.lineTo(point.x, point.y);
	context.stroke();
	drawArrow(context, route.at(-2)!, route.at(-1)!);
	context.restore();
};

const drawGrid = (
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	viewport: Viewport,
	palette: CanvasPalette,
) => {
	let worldGap = 24;
	while (worldGap * viewport.zoom < 12) worldGap *= 2;
	const gap = worldGap * viewport.zoom;
	const offsetX = ((viewport.x % gap) + gap) % gap;
	const offsetY = ((viewport.y % gap) + gap) % gap;
	context.save();
	context.globalAlpha = 0.35;
	context.fillStyle = palette.line;
	for (let x = offsetX; x <= width; x += gap) {
		for (let y = offsetY; y <= height; y += gap) {
			context.beginPath();
			context.arc(x, y, 1, 0, Math.PI * 2);
			context.fill();
		}
	}
	context.restore();
};

const distanceToSegment = (
	x: number,
	y: number,
	start: EditorItemOriginFlowLayoutPoint,
	end: EditorItemOriginFlowLayoutPoint,
) => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (dx === 0 && dy === 0) return Math.hypot(x - start.x, y - start.y);
	const t = Math.max(
		0,
		Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy)),
	);
	return Math.hypot(x - (start.x + t * dx), y - (start.y + t * dy));
};

const hitTest = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	routes: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
	x: number,
	y: number,
	zoom: number,
): EditorOriginFlowSelection | undefined => {
	for (let index = flow.nodes.length - 1; index >= 0; index -= 1) {
		const node = flow.nodes[index]!;
		const position = positions.get(node.id);
		if (position === undefined) continue;
		if (
			x >= position.x &&
			x <= position.x + position.width &&
			y >= position.y &&
			y <= position.y + position.height
		)
			return {
				id: node.id,
				kind: "node",
			};
	}
	const tolerance = EdgeHitRadiusPx / zoom;
	for (const edge of flow.edges) {
		const route = routes.get(edge.id);
		if (route === undefined) continue;
		for (let index = 1; index < route.length; index += 1) {
			if (distanceToSegment(x, y, route[index - 1]!, route[index]!) <= tolerance)
				return {
					id: edge.id,
					kind: "edge",
				};
		}
	}
	return undefined;
};

const readNodeHighlight = (
	node: EditorItemOriginNode,
	selection: EditorOriginFlowSelection | undefined,
	highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined,
) => {
	if (selection?.kind === "node" && selection.id === node.id) return "selected" as const;
	if (highlight?.nodeIds.has(node.id)) return "active" as const;
	return "idle" as const;
};

/** Renders the passive ELK graph directly to Canvas with imperative pan and zoom. */
export const EditorOriginFlowCanvas = ({
	fitContent,
	flow,
	onSelectionChange,
	positions,
	routes,
	selection,
}: EditorOriginFlowCanvasProps) => {
	const resourceUrls = useEditorResourceUrls();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
	const scheduleDrawRef = useRef<() => void>(() => undefined);
	const viewportRef = useRef<Viewport>(DefaultViewport);
	const panRef = useRef<PanState | undefined>(undefined);
	const frameRef = useRef<number | undefined>(undefined);
	const resetViewportRef = useRef(true);
	const paletteRef = useRef<CanvasPalette | undefined>(undefined);
	const highlight = useMemo(
		() =>
			selection === undefined
				? undefined
				: readEditorOriginFlowHighlight(flow, positions, selection),
		[
			flow,
			positions,
			selection,
		],
	);
	const renderStateRef = useRef<RenderState>({
		fitContent,
		flow,
		highlight,
		positions,
		resourceUrls,
		routes,
		selection,
	});
	renderStateRef.current = {
		fitContent,
		flow,
		highlight,
		positions,
		resourceUrls,
		routes,
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
			viewportRef.current = state.fitContent
				? readFitViewport(state.positions, rect.width, rect.height)
				: DefaultViewport;
			resetViewportRef.current = false;
		}
		const viewport = viewportRef.current;
		const palette = paletteRef.current ?? readCanvasPalette(canvas);
		paletteRef.current = palette;
		context.setTransform(dpr, 0, 0, dpr, 0, 0);
		context.clearRect(0, 0, rect.width, rect.height);
		drawGrid(context, rect.width, rect.height, viewport, palette);

		context.save();
		context.translate(viewport.x, viewport.y);
		context.scale(viewport.zoom, viewport.zoom);
		for (const edge of state.flow.edges) {
			const route = state.routes.get(edge.id);
			if (route === undefined) throw new Error(`Missing routed path for ${edge.id}.`);
			drawEdge(context, edge, route, state.selection, state.highlight, palette);
		}
		for (const node of state.flow.nodes) {
			const position = state.positions.get(node.id);
			if (position === undefined) throw new Error(`Missing layout for ${node.id}.`);
			if (!isNodeVisible(position, viewport, rect.width, rect.height)) continue;
			const nodeHighlight = readNodeHighlight(node, state.selection, state.highlight);
			if (node.kind === "item")
				drawItemNode(
					context,
					node,
					position,
					nodeHighlight,
					state.selection !== undefined,
					palette,
					state.resourceUrls,
					imageCacheRef.current,
					scheduleDrawRef.current,
				);
			else
				drawSourceNode(
					context,
					node,
					position,
					nodeHighlight,
					state.selection !== undefined,
					palette,
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

	useLayoutEffect(() => {
		resetViewportRef.current = true;
		scheduleDraw();
	}, [
		fitContent,
		positions,
		scheduleDraw,
	]);

	useEffect(() => {
		scheduleDraw();
	}, [
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
			const zoom = clampZoom(current.zoom * Math.exp(-event.deltaY * 0.0015));
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
		const hit = hitTest(flow, positions, routes, worldX, worldY, viewport.zoom);
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
		<canvas
			aria-label="Item acquisition graph"
			className="block size-full touch-none cursor-grab text-foreground"
			data-ui="EditorOriginFlowCanvas"
			onPointerCancel={(event) => finishPan(event, true)}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={(event) => finishPan(event, false)}
			ref={canvasRef}
		/>
	);
};
