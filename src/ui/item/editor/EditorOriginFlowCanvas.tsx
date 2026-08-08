import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";

import type {
	EditorItemOriginFlow,
	EditorItemOriginItemNode,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import type {
	EditorItemOriginFlowLayoutNode,
	EditorItemOriginFlowLayoutPoint,
} from "~/ui/item/editor/layoutEditorItemOriginFlowFx";
import {
	type EditorOriginFlowSelection,
	readEditorOriginFlowHighlight,
} from "~/ui/item/editor/readEditorOriginFlowHighlight";
import {
	readEditorOriginFlowNavigation,
	readEditorOriginFlowProducerNavigation,
} from "~/ui/item/editor/readEditorOriginFlowNavigation";
import { EditorOriginFlowShortcutHelp } from "~/ui/item/editor/EditorOriginFlowShortcutHelp";
import {
	type EditorOriginFlowVisualConnection,
	readEditorOriginFlowVisualConnections,
} from "~/ui/item/editor/readEditorOriginFlowVisualConnections";
import {
	popEditorOriginFlowVisit,
	pushEditorOriginFlowVisit,
} from "~/ui/item/editor/readEditorOriginFlowVisitHistory";
import { useEditorResourceUrls } from "~/ui/resource/editor/useEditorResourceUrl";

interface Viewport {
	x: number;
	y: number;
	zoom: number;
}

interface Bounds {
	readonly maxX: number;
	readonly maxY: number;
	readonly minX: number;
	readonly minY: number;
}

interface PanState {
	moved: boolean;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startViewport: Viewport;
}

interface EditorOriginFlowCanvasProps {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly fitContent: boolean;
	readonly flow: EditorItemOriginFlow;
	readonly focusNodeId?: string;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly selection: EditorOriginFlowSelection | undefined;
	readonly onSelectionChange: (selection: EditorOriginFlowSelection | undefined) => void;
}

interface RenderState {
	readonly backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>;
	readonly visualConnections: ReadonlyArray<EditorOriginFlowVisualConnection>;
	readonly fitContent: boolean;
	readonly focusNodeId?: string;
	readonly flow: EditorItemOriginFlow;
	readonly highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined;
	readonly positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>;
	readonly resourceUrls: ReadonlyMap<string, string>;
	readonly edgeBounds: ReadonlyMap<string, Bounds>;
	readonly selection: EditorOriginFlowSelection | undefined;
}

const DefaultViewport: Viewport = {
	x: 24,
	y: 24,
	zoom: 0.75,
};
const MinZoom = 0.025;
const MaxZoom = 1.4;
const SearchFocusZoom = 1;
const FitPaddingRatio = 0.12;
const ClickThreshold = 5;
const EdgeHitRadiusPx = 9;
const EdgeCullPaddingPx = 32;
const MaxCachedImages = 96;

const traceConnectionPath = (
	context: CanvasRenderingContext2D,
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
) => {
	const first = points[0];
	const last = points.at(-1);
	if (first === undefined || last === undefined) return;
	context.moveTo(first.x, first.y);
	for (let index = 1; index < points.length - 1; index += 1) {
		const previous = points[index - 1]!;
		const current = points[index]!;
		const next = points[index + 1]!;
		const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
		const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
		if (incomingLength < 0.001 || outgoingLength < 0.001) {
			context.lineTo(current.x, current.y);
			continue;
		}
		const radius = Math.min(24, incomingLength * 0.28, outgoingLength * 0.28);
		const before = {
			x: current.x - ((current.x - previous.x) / incomingLength) * radius,
			y: current.y - ((current.y - previous.y) / incomingLength) * radius,
		};
		const after = {
			x: current.x + ((next.x - current.x) / outgoingLength) * radius,
			y: current.y + ((next.y - current.y) / outgoingLength) * radius,
		};
		context.lineTo(before.x, before.y);
		context.quadraticCurveTo(current.x, current.y, after.x, after.y);
	}
	context.lineTo(last.x, last.y);
};

interface CanvasPalette {
	readonly accent: string;
	readonly canvas: string;
	readonly danger: string;
	readonly foreground: string;
	readonly info: string;
	readonly itemSurfaces: Readonly<Record<EditorItemOriginItemNode["type"], string>>;
	readonly line: string;
	readonly lineStrong: string;
	readonly muted: string;
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
			canvas: read("--ak-canvas"),
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

const readNodeViewport = (
	position: EditorItemOriginFlowLayoutNode,
	width: number,
	height: number,
	zoom: number,
): Viewport => ({
	x: width / 2 - (position.x + position.width / 2) * zoom,
	y: height / 2 - (position.y + position.height / 2) * zoom,
	zoom,
});

const readInitialFocusPosition = (
	flow: EditorItemOriginFlow,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
) => {
	const candidates = flow.nodes
		.filter(
			(node): node is EditorItemOriginItemNode =>
				node.kind === "item" && node.starterScopes.length > 0,
		)
		.map((node) => ({
			id: node.id,
			position: positions.get(node.id),
		}))
		.filter(
			(
				candidate,
			): candidate is {
				readonly id: string;
				readonly position: EditorItemOriginFlowLayoutNode;
			} => candidate.position !== undefined,
		)
		.sort(
			(left, right) =>
				left.position.flowOrder - right.position.flowOrder ||
				left.id.localeCompare(right.id),
		);
	if (candidates[0] !== undefined) return candidates[0].position;
	return [
		...positions.entries(),
	].sort(
		([leftId, left], [rightId, right]) =>
			left.flowOrder - right.flowOrder || leftId.localeCompare(rightId),
	)[0]?.[1];
};

type FlowNavigationShortcut = "back" | "help" | "home" | "next" | "previous" | "producers";

const readFlowNavigationShortcut = (event: KeyboardEvent): FlowNavigationShortcut | undefined => {
	const target = event.target;
	if (
		event.repeat ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		(target instanceof HTMLElement &&
			(target.isContentEditable ||
				target.tagName === "INPUT" ||
				target.tagName === "SELECT" ||
				target.tagName === "TEXTAREA"))
	)
		return undefined;
	switch (event.key.toLowerCase()) {
		case "n":
			return "next";
		case "p":
			return "previous";
		case "h":
			return "home";
		case "i":
			return "producers";
		case "z":
			return "back";
		case "?":
			return "help";
		default:
			return undefined;
	}
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

const readBackboneBounds = (
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
) =>
	new Map(
		[
			...backbones,
		].map(([id, backbone]) => {
			let minX = Number.POSITIVE_INFINITY;
			let minY = Number.POSITIVE_INFINITY;
			let maxX = Number.NEGATIVE_INFINITY;
			let maxY = Number.NEGATIVE_INFINITY;
			for (const point of backbone) {
				minX = Math.min(minX, point.x);
				minY = Math.min(minY, point.y);
				maxX = Math.max(maxX, point.x);
				maxY = Math.max(maxY, point.y);
			}
			return [
				id,
				{
					maxX,
					maxY,
					minX,
					minY,
				} satisfies Bounds,
			] as const;
		}),
	);

const isEdgeVisible = (bounds: Bounds, viewport: Viewport, width: number, height: number) => {
	const padding = EdgeCullPaddingPx / viewport.zoom;
	const left = -viewport.x / viewport.zoom - padding;
	const top = -viewport.y / viewport.zoom - padding;
	const right = (width - viewport.x) / viewport.zoom + padding;
	const bottom = (height - viewport.y) / viewport.zoom + padding;
	return (
		bounds.maxX >= left && bounds.maxY >= top && bounds.minX <= right && bounds.minY <= bottom
	);
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

const wrapText = (
	context: CanvasRenderingContext2D,
	value: string,
	maxWidth: number,
	maxLines: number,
) => {
	const words = value.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [] as string[];
	const lines: string[] = [];
	let current = "";
	for (let index = 0; index < words.length; index += 1) {
		const word = words[index]!;
		const candidate = current.length === 0 ? word : `${current} ${word}`;
		if (context.measureText(candidate).width <= maxWidth) {
			current = candidate;
			continue;
		}
		if (current.length > 0) {
			lines.push(current);
			current = word;
		} else {
			lines.push(fitText(context, word, maxWidth));
			current = "";
		}
		if (lines.length === maxLines) {
			const remainder = [
				current,
				...words.slice(index + 1),
			]
				.filter(Boolean)
				.join(" ");
			if (remainder.length > 0)
				lines[maxLines - 1] = fitText(
					context,
					`${lines[maxLines - 1]} ${remainder}`,
					maxWidth,
				);
			return lines;
		}
	}
	if (current.length > 0 && lines.length < maxLines) lines.push(current);
	return lines;
};

const drawTextLines = (
	context: CanvasRenderingContext2D,
	lines: ReadonlyArray<string>,
	x: number,
	y: number,
	lineHeight: number,
) => {
	for (const [index, line] of lines.entries()) context.fillText(line, x, y + index * lineHeight);
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
	const centerX = position.x + position.width / 2;
	const centerY = position.y + position.height / 2;
	const radius = position.width / 2;
	context.save();
	context.globalAlpha = selectionActive && highlight === "idle" ? 0.18 : 1;
	context.beginPath();
	context.arc(centerX, centerY, radius, 0, Math.PI * 2);
	context.fillStyle = palette.itemSurfaces[node.type];
	context.fill();
	context.lineWidth = highlight === "selected" ? 5 : highlight === "active" ? 3 : 2;
	context.strokeStyle = highlight === "idle" ? typeColor : palette.accent;
	context.stroke();

	const artworkSize = Math.max(44, Math.min(96, position.width * 0.25));
	const titleFontSize = Math.max(12, Math.min(22, position.width * 0.055));
	const titleLineHeight = titleFontSize * 1.15;
	const metaFontSize = Math.max(9, Math.min(13, position.width * 0.032));
	const innerWidth = position.width * 0.7;
	context.textAlign = "center";
	context.textBaseline = "top";
	context.font = `600 ${titleFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
	const titleLines = wrapText(context, node.title, innerWidth, 2);
	const titleHeight = titleLines.length * titleLineHeight;
	const metaHeight = metaFontSize * 2.4;
	const gap = Math.max(6, position.width * 0.02);
	const contentHeight = artworkSize + gap + titleHeight + gap + metaHeight;
	let contentY = centerY - contentHeight / 2;
	drawItemArtwork(
		context,
		node,
		resourceUrls,
		imageCache,
		onImageReady,
		centerX - artworkSize / 2,
		contentY,
		artworkSize,
		palette,
	);
	contentY += artworkSize + gap;
	context.fillStyle = palette.foreground;
	context.font = `600 ${titleFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
	drawTextLines(context, titleLines, centerX, contentY, titleLineHeight);
	contentY += titleHeight + gap;
	context.fillStyle = palette.muted;
	context.font = `600 ${metaFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
	context.fillText(node.type.toUpperCase(), centerX, contentY);
	contentY += metaFontSize * 1.3;
	context.font = `${metaFontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
	context.fillText(`${position.degree} links · ${position.portCount} ports`, centerX, contentY);
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
	connection: EditorOriginFlowVisualConnection,
	backbone: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	selection: EditorOriginFlowSelection | undefined,
	highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined,
	palette: CanvasPalette,
) => {
	const first = backbone[0];
	if (first === undefined) return;
	const selected = selection?.kind === "edge" && connection.edgeIds.includes(selection.id);
	const active = connection.edgeIds.some((edgeId) => highlight?.edgeIds.has(edgeId) ?? false);
	const emphasized = selected || active;

	context.save();
	context.globalAlpha = emphasized ? 1 : 0.6;
	context.lineJoin = "round";
	context.lineCap = "round";
	context.strokeStyle = emphasized ? palette.accent : palette.lineStrong;
	context.fillStyle = emphasized ? palette.accent : palette.lineStrong;
	context.lineWidth = 1;
	context.beginPath();
	traceConnectionPath(context, backbone);
	context.stroke();

	const last = backbone.at(-1)!;
	const previous = backbone.at(-2) ?? first;
	drawArrow(context, previous, last);
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

const distanceToPolyline = (
	x: number,
	y: number,
	points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
) => {
	let distance = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1)
		distance = Math.min(distance, distanceToSegment(x, y, points[index - 1]!, points[index]!));
	return distance;
};

type FlowHit = EditorOriginFlowSelection;

const hitTest = (
	flow: EditorItemOriginFlow,
	connections: ReadonlyArray<EditorOriginFlowVisualConnection>,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
	x: number,
	y: number,
	zoom: number,
): FlowHit | undefined => {
	for (let index = flow.nodes.length - 1; index >= 0; index -= 1) {
		const node = flow.nodes[index]!;
		const position = positions.get(node.id);
		if (position === undefined) continue;
		const centerX = position.x + position.width / 2;
		const centerY = position.y + position.height / 2;
		if (Math.hypot(x - centerX, y - centerY) <= position.width / 2)
			return {
				id: node.id,
				kind: "node",
			};
	}
	const tolerance = EdgeHitRadiusPx / zoom;
	for (const connection of connections) {
		const representativeEdgeId = connection.edgeIds[0];
		if (representativeEdgeId === undefined) continue;
		const backbone = backbones.get(representativeEdgeId);
		if (backbone === undefined || distanceToPolyline(x, y, backbone) > tolerance) continue;
		return {
			id: representativeEdgeId,
			kind: "edge",
		};
	}
	return undefined;
};

const readNodeHighlight = (
	node: EditorItemOriginItemNode,
	selection: EditorOriginFlowSelection | undefined,
	highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined,
	navigationFocusNodeId: string | undefined,
) => {
	if (selection?.kind === "node" && selection.id === node.id) return "selected" as const;
	if (navigationFocusNodeId === node.id || highlight?.nodeIds.has(node.id))
		return "active" as const;
	return "idle" as const;
};

/** Renders the passive item flow directly to Canvas with imperative pan and zoom. */
export const EditorOriginFlowCanvas = ({
	backbones,
	fitContent,
	flow,
	focusNodeId,
	onSelectionChange,
	positions,
	selection,
}: EditorOriginFlowCanvasProps) => {
	const resourceUrls = useEditorResourceUrls();
	const edgeBounds = useMemo(
		() => readBackboneBounds(backbones),
		[
			backbones,
		],
	);
	const visualConnections = useMemo(
		() => readEditorOriginFlowVisualConnections(flow.edges),
		[
			flow.edges,
		],
	);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
	const scheduleDrawRef = useRef<() => void>(() => undefined);
	const viewportRef = useRef<Viewport>(DefaultViewport);
	const panRef = useRef<PanState | undefined>(undefined);
	const frameRef = useRef<number | undefined>(undefined);
	const resetViewportRef = useRef(true);
	const navigationIndexRef = useRef(0);
	const producerNavigationIndexRef = useRef(-1);
	const producerNavigationFocusNodeIdRef = useRef<string | undefined>(undefined);
	const visitHistoryRef = useRef<ReadonlyArray<string>>([]);
	const [helpOpen, setHelpOpen] = useState(false);
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
	const navigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? readEditorOriginFlowNavigation(flow, positions, selection.id, highlight?.edgeIds)
				: [],
		[
			flow,
			positions,
			selection,
			highlight,
		],
	);
	const producerNavigationNodeIds = useMemo(
		() =>
			selection?.kind === "node"
				? readEditorOriginFlowProducerNavigation(flow, selection.id)
				: [],
		[
			flow,
			selection,
		],
	);
	const renderStateRef = useRef<RenderState>({
		backbones,
		visualConnections,
		fitContent,
		flow,
		focusNodeId,
		highlight,
		positions,
		resourceUrls,
		edgeBounds,
		selection,
	});
	renderStateRef.current = {
		backbones,
		visualConnections,
		fitContent,
		flow,
		focusNodeId,
		highlight,
		positions,
		resourceUrls,
		edgeBounds,
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
			const initialPosition = readInitialFocusPosition(state.flow, state.positions);
			viewportRef.current =
				explicitFocusPosition !== undefined
					? readNodeViewport(
							explicitFocusPosition,
							rect.width,
							rect.height,
							SearchFocusZoom,
						)
					: state.fitContent
						? readFitViewport(state.positions, rect.width, rect.height)
						: initialPosition === undefined
							? DefaultViewport
							: readNodeViewport(
									initialPosition,
									rect.width,
									rect.height,
									DefaultViewport.zoom,
								);
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
		for (const connection of state.visualConnections) {
			const representativeEdgeId = connection.edgeIds[0];
			if (representativeEdgeId === undefined) continue;
			const backbone = state.backbones.get(representativeEdgeId);
			if (backbone === undefined)
				throw new Error(`Missing map connection for ${representativeEdgeId}.`);
			const bounds = state.edgeBounds.get(representativeEdgeId);
			if (bounds === undefined)
				throw new Error(`Missing edge bounds for ${representativeEdgeId}.`);
			if (!isEdgeVisible(bounds, viewport, rect.width, rect.height)) continue;
			drawEdge(context, connection, backbone, state.selection, state.highlight, palette);
		}
		for (const node of state.flow.nodes) {
			const position = state.positions.get(node.id);
			if (position === undefined) throw new Error(`Missing layout for ${node.id}.`);
			if (!isNodeVisible(position, viewport, rect.width, rect.height)) continue;
			const nodeHighlight = readNodeHighlight(
				node,
				state.selection,
				state.highlight,
				producerNavigationFocusNodeIdRef.current,
			);
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
		if (focusNodeId === undefined) return;
		const canvas = canvasRef.current;
		const position = positions.get(focusNodeId);
		if (canvas === null || position === undefined) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		viewportRef.current = readNodeViewport(position, rect.width, rect.height, SearchFocusZoom);
		navigationIndexRef.current = 0;
		resetViewportRef.current = false;
		scheduleDraw();
	}, [
		focusNodeId,
		positions,
		scheduleDraw,
	]);

	useEffect(() => {
		scheduleDraw();
	}, [
		visualConnections,
		flow,
		highlight,
		resourceUrls,
		scheduleDraw,
		selection,
	]);

	useEffect(() => {
		navigationIndexRef.current = 0;
	}, [
		navigationNodeIds,
	]);

	useEffect(() => {
		producerNavigationIndexRef.current = -1;
	}, [
		producerNavigationNodeIds,
	]);

	useEffect(() => {
		producerNavigationFocusNodeIdRef.current = undefined;
	}, [
		selection,
	]);

	useEffect(() => {
		visitHistoryRef.current = [];
	}, [
		flow,
	]);

	useEffect(() => {
		const focusPosition = (position: EditorItemOriginFlowLayoutNode, zoom: number) => {
			const canvas = canvasRef.current;
			if (canvas === null) return false;
			const rect = canvas.getBoundingClientRect();
			viewportRef.current = readNodeViewport(position, rect.width, rect.height, zoom);
			scheduleDraw();
			return true;
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (helpOpen) {
				if (event.key === "Escape" || event.key === "?") {
					event.preventDefault();
					setHelpOpen(false);
				}
				return;
			}
			const shortcut = readFlowNavigationShortcut(event);
			if (shortcut === undefined) return;
			event.preventDefault();

			if (shortcut === "help") {
				setHelpOpen(true);
				return;
			}

			if (shortcut === "back") {
				const back = popEditorOriginFlowVisit(visitHistoryRef.current);
				if (back.nodeId === undefined) return;
				const position = positions.get(back.nodeId);
				if (position === undefined) return;
				visitHistoryRef.current = back.history;
				producerNavigationFocusNodeIdRef.current = undefined;
				navigationIndexRef.current = 0;
				onSelectionChange({
					id: back.nodeId,
					kind: "node",
				});
				focusPosition(position, Math.max(viewportRef.current.zoom, DefaultViewport.zoom));
				return;
			}

			if (shortcut === "home") {
				producerNavigationFocusNodeIdRef.current = undefined;
				const homeNodeId = navigationNodeIds[0];
				const homePosition =
					homeNodeId === undefined
						? readInitialFocusPosition(flow, positions)
						: positions.get(homeNodeId);
				if (homePosition === undefined) return;
				if (
					focusPosition(
						homePosition,
						Math.max(viewportRef.current.zoom, DefaultViewport.zoom),
					)
				)
					navigationIndexRef.current = 0;
				return;
			}

			if (shortcut === "producers") {
				if (producerNavigationNodeIds.length === 0) return;
				const nextIndex =
					(producerNavigationIndexRef.current + 1) % producerNavigationNodeIds.length;
				const nodeId = producerNavigationNodeIds[nextIndex];
				if (nodeId === undefined) return;
				const position = positions.get(nodeId);
				if (position === undefined) return;
				producerNavigationFocusNodeIdRef.current = nodeId;
				if (
					focusPosition(
						position,
						Math.max(viewportRef.current.zoom, DefaultViewport.zoom),
					)
				)
					producerNavigationIndexRef.current = nextIndex;
				return;
			}

			producerNavigationFocusNodeIdRef.current = undefined;
			if (navigationNodeIds.length === 0) return;
			const offset = shortcut === "next" ? 1 : -1;
			const nextIndex =
				(navigationIndexRef.current + offset + navigationNodeIds.length) %
				navigationNodeIds.length;
			const nodeId = navigationNodeIds[nextIndex];
			if (nodeId === undefined) return;
			const position = positions.get(nodeId);
			if (position === undefined) return;
			if (focusPosition(position, Math.max(viewportRef.current.zoom, DefaultViewport.zoom)))
				navigationIndexRef.current = nextIndex;
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		flow,
		helpOpen,
		navigationNodeIds,
		onSelectionChange,
		positions,
		producerNavigationNodeIds,
		scheduleDraw,
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
		const hit = hitTest(
			flow,
			visualConnections,
			positions,
			backbones,
			worldX,
			worldY,
			viewport.zoom,
		);
		if (hit?.kind === "node") {
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node")
				visitHistory = pushEditorOriginFlowVisit(visitHistory, selection.id);
			visitHistoryRef.current = pushEditorOriginFlowVisit(visitHistory, hit.id);
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
			{helpOpen ? <EditorOriginFlowShortcutHelp onClose={() => setHelpOpen(false)} /> : null}
		</>
	);
};
