import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginEdge,
	type EditorItemOriginFlow,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperationKind,
} from "~/bridge/item/editor/readEditorItemOriginFlow";
import { ItemTypeLabel } from "~/ui/item-detail/ItemInfoPresentation";
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
	type EditorOriginFlowConnectedPorts,
	readEditorOriginFlowConnectedPorts,
} from "~/ui/item/editor/readEditorOriginFlowConnectedPorts";
import {
	EditorOriginFlowOperationContentPadding,
	EditorOriginFlowOperationHeaderHeight,
	EditorOriginFlowOperationSidePadding,
	readEditorOriginFlowItemPortY,
	readEditorOriginFlowNodeMetrics,
} from "~/ui/item/editor/readEditorOriginFlowNodeMetrics";
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
	readonly connectedPorts: EditorOriginFlowConnectedPorts;
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
const PortHitRadiusPx = 11;
const EdgeCullPaddingPx = 32;
const MaxCachedImages = 96;

const IncomeBranchColors = [
	"#2e91e5",
	"#e15f99",
	"#1ca71c",
	"#fb0d0d",
	"#da16ff",
	"#6b7280",
	"#b68100",
	"#750d86",
	"#eb663b",
	"#511cfb",
	"#00a08b",
	"#fb00d1",
] as const;

const hashString = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

const readIncomeBranchColor = (selectionId: string, branchIndex: number) => {
	const offset = hashString(selectionId) % IncomeBranchColors.length;
	return IncomeBranchColors[(offset + branchIndex) % IncomeBranchColors.length]!;
};

const traceOrthogonalPath = (
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
	readonly sourceSurfaces: Readonly<Record<EditorItemOriginOperationKind, string>>;
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

const readSourceKindColor = (palette: CanvasPalette, kind: EditorItemOriginOperationKind) => {
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

const SourceKindIconPath: Record<EditorItemOriginOperationKind, string> = {
	line: "M12 16h.01M16 16h.01M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zm5-3h.01",
	charges:
		"m11 7-3 5h4l-3 5m5.856-11H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935M22 14v-4M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936",
	merge: "M14 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1m5-7a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1M7 15l3 3m-3 3 3-3H5a2 2 0 0 1-2-2v-2",
	expiry: "M10 2h4m-2 12 3-3",
};
const sourceIconPathCache = new Map<EditorItemOriginOperationKind, Path2D>();

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

const wrapIdentifier = (
	context: CanvasRenderingContext2D,
	value: string,
	maxWidth: number,
	maxLines: number,
) => {
	const lines: string[] = [];
	let remaining = value.trim();
	while (remaining.length > 0 && lines.length < maxLines) {
		if (context.measureText(remaining).width <= maxWidth) {
			lines.push(remaining);
			break;
		}

		let end = 1;
		while (
			end < remaining.length &&
			context.measureText(remaining.slice(0, end + 1)).width <= maxWidth
		)
			end += 1;
		if (lines.length === maxLines - 1) {
			lines.push(fitText(context, remaining, maxWidth));
			break;
		}

		let breakAt = end;
		for (let index = end - 1; index >= Math.floor(end * 0.55); index -= 1) {
			if (":/-_.".includes(remaining[index]!)) {
				breakAt = index + 1;
				break;
			}
		}
		lines.push(remaining.slice(0, breakAt));
		remaining = remaining.slice(breakAt);
	}
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

const drawSourceIcon = (
	context: CanvasRenderingContext2D,
	kind: EditorItemOriginOperationKind,
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

const drawFlowPort = (
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	color: string,
	background: string,
) => {
	context.beginPath();
	context.arc(x, y, 6, 0, Math.PI * 2);
	context.fillStyle = background;
	context.fill();
	context.lineWidth = 2.5;
	context.strokeStyle = color;
	context.stroke();
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
	connectedPortIds: ReadonlySet<string> | undefined,
) => {
	const typeColor = readItemTypeColor(palette, node.type);
	const metrics = readEditorOriginFlowNodeMetrics(node);
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
	if (connectedPortIds?.has(EditorItemOriginItemInputPortId) === true)
		drawFlowPort(
			context,
			position.x,
			position.y + readEditorOriginFlowItemPortY(metrics.headerHeight),
			typeColor,
			palette.itemSurfaces[node.type],
		);
	if (connectedPortIds?.has(EditorItemOriginItemOutputPortId) === true)
		drawFlowPort(
			context,
			position.x + position.width,
			position.y + readEditorOriginFlowItemPortY(metrics.headerHeight),
			typeColor,
			palette.itemSurfaces[node.type],
		);

	const artworkSize = 68;
	const artworkX = position.x + 16;
	const artworkY = position.y + (metrics.headerHeight - artworkSize) / 2;
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

	const textX = artworkX + artworkSize + 18;
	const maxTextWidth = position.x + position.width - 18 - textX;
	const titleLineHeight = 19;
	const idLineHeight = 16;
	const labelLineHeight = 12;
	const blockGap = 7;
	context.textBaseline = "top";
	context.fillStyle = palette.foreground;
	context.font = "600 15px Inter, ui-sans-serif, system-ui, sans-serif";
	const titleLines = wrapText(context, node.title, maxTextWidth, 2);
	context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
	const idLines = wrapIdentifier(context, node.itemId, maxTextWidth, 2);
	const textHeight =
		titleLines.length * titleLineHeight +
		blockGap +
		idLines.length * idLineHeight +
		blockGap +
		labelLineHeight;
	let textY = position.y + (metrics.headerHeight - textHeight) / 2;

	context.fillStyle = palette.foreground;
	context.font = "600 15px Inter, ui-sans-serif, system-ui, sans-serif";
	drawTextLines(context, titleLines, textX, textY, titleLineHeight);
	textY += titleLines.length * titleLineHeight + blockGap;

	context.fillStyle = palette.muted;
	context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
	drawTextLines(context, idLines, textX, textY, idLineHeight);
	textY += idLines.length * idLineHeight + blockGap;

	context.font = "600 10px Inter, ui-sans-serif, system-ui, sans-serif";
	const label =
		node.starterScopes.length > 0
			? `Starter: ${node.starterScopes.join(", ")}`
			: node.type === "missing"
				? "Missing item"
				: ItemTypeLabel[node.type];
	context.fillText(fitText(context, label.toUpperCase(), maxTextWidth), textX, textY);

	if (node.operations.length > 0) {
		context.beginPath();
		context.moveTo(position.x + 12, position.y + metrics.headerHeight - 1);
		context.lineTo(position.x + position.width - 12, position.y + metrics.headerHeight - 1);
		context.strokeStyle = palette.lineStrong;
		context.globalAlpha *= 0.35;
		context.lineWidth = 1;
		context.stroke();
		context.globalAlpha = selectionActive && highlight === "idle" ? 0.2 : 1;
	}

	for (const [operationIndex, operation] of node.operations.entries()) {
		const operationMetrics = metrics.operations[operationIndex];
		if (operationMetrics === undefined) continue;
		const kindColor = readSourceKindColor(palette, operation.kind);
		const rowX = position.x + EditorOriginFlowOperationSidePadding;
		const rowY = position.y + operationMetrics.top;
		const rowWidth = position.width - EditorOriginFlowOperationSidePadding * 2;
		const rowHeight = operationMetrics.height;
		drawRoundedRect(context, rowX, rowY, rowWidth, rowHeight, 10);
		context.fillStyle = palette.sourceSurfaces[operation.kind];
		context.fill();
		context.globalAlpha *= 0.7;
		context.strokeStyle = kindColor;
		context.lineWidth = 1.25;
		context.stroke();
		context.globalAlpha = selectionActive && highlight === "idle" ? 0.2 : 1;

		const iconSize = 18;
		const headerX = rowX + EditorOriginFlowOperationContentPadding;
		const headerCenterY =
			rowY +
			EditorOriginFlowOperationContentPadding +
			EditorOriginFlowOperationHeaderHeight / 2;
		drawSourceIcon(
			context,
			operation.kind,
			headerX,
			headerCenterY - iconSize / 2,
			iconSize,
			kindColor,
		);
		context.fillStyle = palette.foreground;
		context.font = "600 12px Inter, ui-sans-serif, system-ui, sans-serif";
		context.textBaseline = "middle";
		context.textAlign = "left";
		context.fillText(
			fitText(
				context,
				operation.label,
				rowWidth - EditorOriginFlowOperationContentPadding * 2 - iconSize - 8,
			),
			headerX + iconSize + 8,
			headerCenterY,
		);

		context.font = "500 11px Inter, ui-sans-serif, system-ui, sans-serif";
		for (const input of operation.inputs) {
			const portY = operationMetrics.inputPortYs.get(input.id);
			if (portY === undefined) continue;
			const worldY = position.y + portY;
			if (connectedPortIds?.has(input.id) === true)
				drawFlowPort(
					context,
					position.x,
					worldY,
					kindColor,
					palette.itemSurfaces[node.type],
				);
			context.fillStyle = palette.foreground;
			context.textAlign = "left";
			context.textBaseline = "middle";
			context.fillText(
				fitText(context, input.label, 104),
				rowX + EditorOriginFlowOperationContentPadding,
				worldY,
			);
		}
		for (const output of operation.outputs) {
			const portY = operationMetrics.outputPortYs.get(output.id);
			if (portY === undefined) continue;
			const worldY = position.y + portY;
			if (connectedPortIds?.has(output.id) === true)
				drawFlowPort(
					context,
					position.x + position.width,
					worldY,
					kindColor,
					palette.itemSurfaces[node.type],
				);
			context.fillStyle = palette.foreground;
			context.textAlign = "right";
			context.textBaseline = "middle";
			context.fillText(
				fitText(context, output.label, 104),
				rowX + rowWidth - EditorOriginFlowOperationContentPadding,
				worldY,
			);
		}
	}
	context.textAlign = "start";
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
	backbone: ReadonlyArray<EditorItemOriginFlowLayoutPoint>,
	selection: EditorOriginFlowSelection | undefined,
	highlight: ReturnType<typeof readEditorOriginFlowHighlight> | undefined,
	palette: CanvasPalette,
) => {
	const first = backbone[0];
	if (first === undefined) return;
	const selected = selection?.kind === "edge" && selection.id === edge.id;
	const active = highlight?.edgeIds.has(edge.id) ?? false;
	const selectedNodeId = selection?.kind === "node" ? selection.id : undefined;
	const branchIndexes =
		selectedNodeId !== undefined && active
			? (highlight?.branchIndexesByEdgeId.get(edge.id) ?? [])
			: [];
	const alpha = selection === undefined ? 0.6 : active ? 1 : 0.6;
	const branchIndex = branchIndexes[0];
	const edgeColor =
		branchIndex === undefined || selectedNodeId === undefined
			? palette.accent
			: readIncomeBranchColor(selectedNodeId, branchIndex);

	context.save();
	context.globalAlpha = alpha;
	context.lineJoin = "round";
	context.lineCap = "round";
	context.strokeStyle = edgeColor;
	context.fillStyle = edgeColor;
	context.lineWidth = selected ? 4.8 : active ? 4 : 2;
	context.beginPath();
	traceOrthogonalPath(context, backbone);
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

type FlowHit =
	| EditorOriginFlowSelection
	| {
			readonly kind: "port";
			readonly targetNodeId: string;
	  };

const hitTest = (
	flow: EditorItemOriginFlow,
	connectedPorts: EditorOriginFlowConnectedPorts,
	positions: ReadonlyMap<string, EditorItemOriginFlowLayoutNode>,
	backbones: ReadonlyMap<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>,
	x: number,
	y: number,
	zoom: number,
): FlowHit | undefined => {
	const portTolerance = PortHitRadiusPx / zoom;
	for (let index = flow.nodes.length - 1; index >= 0; index -= 1) {
		const node = flow.nodes[index]!;
		const position = positions.get(node.id);
		if (position === undefined) continue;
		const metrics = readEditorOriginFlowNodeMetrics(node);
		const connectedPortIds = connectedPorts.get(node.id);
		for (const [operationIndex, operation] of node.operations.entries()) {
			const operationMetrics = metrics.operations[operationIndex];
			if (operationMetrics === undefined) continue;
			for (const input of operation.inputs) {
				if (connectedPortIds?.has(input.id) !== true) continue;
				const localY = operationMetrics.inputPortYs.get(input.id);
				if (localY === undefined) continue;
				if (Math.hypot(x - position.x, y - (position.y + localY)) <= portTolerance) {
					const targetNodeId = `item:${input.itemId}`;
					if (positions.has(targetNodeId))
						return {
							kind: "port",
							targetNodeId,
						};
				}
			}
			for (const output of operation.outputs) {
				if (connectedPortIds?.has(output.id) !== true) continue;
				const localY = operationMetrics.outputPortYs.get(output.id);
				if (localY === undefined) continue;
				if (
					Math.hypot(x - (position.x + position.width), y - (position.y + localY)) <=
					portTolerance
				) {
					const targetNodeId = `item:${output.itemId}`;
					if (positions.has(targetNodeId))
						return {
							kind: "port",
							targetNodeId,
						};
				}
			}
		}
	}

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
		const backbone = backbones.get(edge.id);
		if (backbone === undefined || distanceToPolyline(x, y, backbone) > tolerance) continue;
		return {
			id: edge.id,
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
	const connectedPorts = useMemo(
		() => readEditorOriginFlowConnectedPorts(flow.edges),
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
		connectedPorts,
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
		connectedPorts,
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
		for (const edge of state.flow.edges) {
			const backbone = state.backbones.get(edge.id);
			if (backbone === undefined) throw new Error(`Missing routed backbone for ${edge.id}.`);
			const bounds = state.edgeBounds.get(edge.id);
			if (bounds === undefined) throw new Error(`Missing edge bounds for ${edge.id}.`);
			if (!isEdgeVisible(bounds, viewport, rect.width, rect.height)) continue;
			drawEdge(context, edge, backbone, state.selection, state.highlight, palette);
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
				state.connectedPorts.get(node.id),
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
		connectedPorts,
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
			connectedPorts,
			positions,
			backbones,
			worldX,
			worldY,
			viewport.zoom,
		);
		if (hit?.kind === "port") {
			const targetPosition = positions.get(hit.targetNodeId);
			if (targetPosition === undefined) return;
			viewportRef.current = readNodeViewport(
				targetPosition,
				rect.width,
				rect.height,
				Math.max(viewport.zoom, DefaultViewport.zoom),
			);
			navigationIndexRef.current = 0;
			let visitHistory = visitHistoryRef.current;
			if (selection?.kind === "node")
				visitHistory = pushEditorOriginFlowVisit(visitHistory, selection.id);
			visitHistoryRef.current = pushEditorOriginFlowVisit(visitHistory, hit.targetNodeId);
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
