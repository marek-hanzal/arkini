import { Effect } from "effect";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperationKind,
} from "~/flow/type/EditorItemOriginFlow";
import type { CanvasPalette } from "~/flow-canvas/type/CanvasPalette";
import type { Highlight, Selection } from "~/flow-canvas/type/Highlight";
import {
	OperationContentPadding,
	OperationHeaderHeight,
	OperationSidePadding,
	type NodeMetrics,
} from "~/flow-layout/fn/readNodeMetricsFn";
import type { LayoutNode, LayoutPoint } from "~/flow-layout/type/Layout";
import type { Viewport } from "~/flow-canvas/type/Viewport";
import { ItemTypeLabel } from "~/item-definition/ui/ItemDefinitionLabels";

const MaxCachedImages = 96;

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

/** Creates item-artwork composition backed by the bounded Canvas image cache. */
const createCanvasArtworkPainterFx = Effect.fn("createCanvasArtworkPainterFx")(() =>
	Effect.succeed({
		drawItemArtwork,
	} as const),
);

const readFittingPrefixLength = (
	context: CanvasRenderingContext2D,
	value: string,
	maxWidth: number,
	suffix = "",
) => {
	let lower = 0;
	let upper = value.length;
	while (lower < upper) {
		const middle = Math.ceil((lower + upper) / 2);
		if (context.measureText(`${value.slice(0, middle)}${suffix}`).width <= maxWidth)
			lower = middle;
		else upper = middle - 1;
	}
	return lower;
};

const fitText = (context: CanvasRenderingContext2D, value: string, maxWidth: number) => {
	if (context.measureText(value).width <= maxWidth) return value;
	const end = readFittingPrefixLength(context, value, maxWidth, "…");
	return end === 0 ? "" : `${value.slice(0, end)}…`;
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

		const end = Math.max(1, readFittingPrefixLength(context, remaining, maxWidth));
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

/** Creates the fitting and wrapping policy used by Canvas flow labels. */
const createCanvasTextPainterFx = Effect.fn("createCanvasTextPainterFx")(() =>
	Effect.succeed({
		drawTextLines,
		fitText,
		wrapIdentifier,
		wrapText,
	} as const),
);

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
		case "space":
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

const drawNodeFrame = (
	context: CanvasRenderingContext2D,
	position: LayoutNode,
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
	highlightColor?: string,
) => {
	context.beginPath();
	context.arc(x, y, 6, 0, Math.PI * 2);
	context.fillStyle = highlightColor ?? background;
	context.fill();
	context.lineWidth = 2.5;
	context.strokeStyle = highlightColor ?? color;
	context.stroke();
};

const createDrawItemNode =
	(
		FlowTextPainter: Effect.Success<ReturnType<typeof createCanvasTextPainterFx>>,
		FlowArtworkPainter: Effect.Success<ReturnType<typeof createCanvasArtworkPainterFx>>,
	) =>
	(
		context: CanvasRenderingContext2D,
		node: EditorItemOriginItemNode,
		position: LayoutNode,
		metrics: NodeMetrics,
		highlight: "active" | "idle" | "selected",
		opacity: number,
		palette: CanvasPalette,
		resourceUrls: ReadonlyMap<string, string>,
		imageCache: Map<string, HTMLImageElement>,
		onImageReady: () => void,
		connectedPortIds: ReadonlySet<string> | undefined,
		highlightedPortColors: ReadonlyMap<string, string> | undefined,
	) => {
		const typeColor = readItemTypeColor(palette, node.type);
		context.save();
		context.globalAlpha = opacity;
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
				position.y + metrics.itemPortY,
				typeColor,
				palette.itemSurfaces[node.type],
				highlightedPortColors?.get(EditorItemOriginItemInputPortId),
			);
		if (connectedPortIds?.has(EditorItemOriginItemOutputPortId) === true)
			drawFlowPort(
				context,
				position.x + position.width,
				position.y + metrics.itemPortY,
				typeColor,
				palette.itemSurfaces[node.type],
				highlightedPortColors?.get(EditorItemOriginItemOutputPortId),
			);

		const artworkSize = 68;
		const artworkX = position.x + 16;
		const artworkY = position.y + (metrics.headerHeight - artworkSize) / 2;
		FlowArtworkPainter.drawItemArtwork(
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

		const textX = position.x + metrics.itemTextBounds.x;
		const maxTextWidth = metrics.itemTextBounds.width;
		const titleLineHeight = 19;
		const idLineHeight = 16;
		const labelLineHeight = 12;
		const blockGap = 7;
		context.textBaseline = "top";
		context.fillStyle = palette.foreground;
		context.font = "600 15px Inter, ui-sans-serif, system-ui, sans-serif";
		const titleLines = FlowTextPainter.wrapText(context, node.title, maxTextWidth, 2);
		context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
		const idLines = FlowTextPainter.wrapIdentifier(context, node.itemId, maxTextWidth, 2);
		const textHeight =
			titleLines.length * titleLineHeight +
			blockGap +
			idLines.length * idLineHeight +
			blockGap +
			labelLineHeight;
		let textY = position.y + (metrics.headerHeight - textHeight) / 2;

		context.fillStyle = palette.foreground;
		context.font = "600 15px Inter, ui-sans-serif, system-ui, sans-serif";
		FlowTextPainter.drawTextLines(context, titleLines, textX, textY, titleLineHeight);
		textY += titleLines.length * titleLineHeight + blockGap;

		context.fillStyle = palette.muted;
		context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
		FlowTextPainter.drawTextLines(context, idLines, textX, textY, idLineHeight);
		textY += idLines.length * idLineHeight + blockGap;

		context.font = "600 10px Inter, ui-sans-serif, system-ui, sans-serif";
		const label =
			node.starterScopes.length > 0
				? `Starter: ${node.starterScopes.join(", ")}`
				: node.type === "missing"
					? "Missing item"
					: ItemTypeLabel[node.type];
		context.fillText(
			FlowTextPainter.fitText(context, label.toUpperCase(), maxTextWidth),
			textX,
			textY,
		);

		if (node.operations.length > 0) {
			context.beginPath();
			context.moveTo(position.x + 12, position.y + metrics.headerHeight - 1);
			context.lineTo(position.x + position.width - 12, position.y + metrics.headerHeight - 1);
			context.strokeStyle = palette.lineStrong;
			context.globalAlpha *= 0.35;
			context.lineWidth = 1;
			context.stroke();
			context.globalAlpha = opacity;
		}

		for (const [operationIndex, operation] of node.operations.entries()) {
			const operationMetrics = metrics.operations[operationIndex];
			if (operationMetrics === undefined) continue;
			const kindColor = readSourceKindColor(palette, operation.kind);
			const rowX = position.x + OperationSidePadding;
			const rowY = position.y + operationMetrics.top;
			const rowWidth = position.width - OperationSidePadding * 2;
			const rowHeight = operationMetrics.height;
			drawRoundedRect(context, rowX, rowY, rowWidth, rowHeight, 10);
			context.fillStyle = palette.sourceSurfaces[operation.kind];
			context.fill();
			context.globalAlpha *= 0.7;
			context.strokeStyle = kindColor;
			context.lineWidth = 1.25;
			context.stroke();
			context.globalAlpha = opacity;

			const iconSize = 18;
			const headerX = rowX + OperationContentPadding;
			const headerCenterY = rowY + OperationContentPadding + OperationHeaderHeight / 2;
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
				FlowTextPainter.fitText(
					context,
					operation.label,
					rowWidth - OperationContentPadding * 2 - iconSize - 8,
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
						highlightedPortColors?.get(input.id),
					);
				context.fillStyle = palette.foreground;
				context.textAlign = "left";
				context.textBaseline = "middle";
				context.fillText(
					FlowTextPainter.fitText(context, input.label, 104),
					rowX + OperationContentPadding,
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
						highlightedPortColors?.get(output.id),
					);
				context.fillStyle = palette.foreground;
				context.textAlign = "right";
				context.textBaseline = "middle";
				context.fillText(
					FlowTextPainter.fitText(context, output.label, 104),
					rowX + rowWidth - OperationContentPadding,
					worldY,
				);
			}
		}
		context.textAlign = "start";
		context.restore();
	};

/** Creates the token-aware Canvas painter for editor origin-flow item nodes. */
const createCanvasNodePainterFx = Effect.fn("createCanvasNodePainterFx")(function* () {
	const FlowTextPainter = yield* createCanvasTextPainterFx();
	const FlowArtworkPainter = yield* createCanvasArtworkPainterFx();
	return {
		drawItemNode: createDrawItemNode(FlowTextPainter, FlowArtworkPainter),
	} as const;
});

const HighlightMinimumOpacity = 0.28;
const HighlightOpacityStep = 0.12;

const readHighlightOpacity = (level: number | undefined) =>
	level === undefined
		? 1
		: Math.max(HighlightMinimumOpacity, 1 - Math.max(0, level) * HighlightOpacityStep);

const readNodeHighlight = (
	node: EditorItemOriginItemNode,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
	navigationFocusNodeId: string | undefined,
) => {
	if (selection?.kind === "node" && selection.id === node.id) return "selected" as const;
	if (navigationFocusNodeId === node.id || highlight?.nodeIds.has(node.id))
		return "active" as const;
	return "idle" as const;
};

const readNodeOpacity = (
	nodeId: string,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
	navigationFocusNodeId: string | undefined,
) => {
	if (selection === undefined) return 1;
	if (selection.kind === "edge") return highlight?.nodeIds.has(nodeId) === true ? 1 : 0.2;
	if (selection.id === nodeId || navigationFocusNodeId === nodeId) return 1;
	const level = highlight?.nodeLevels.get(nodeId);
	return level === undefined ? 0 : readHighlightOpacity(level);
};

const readEdgeOpacity = (
	edgeId: string,
	highlighted: boolean,
	selection: Selection | undefined,
	highlight: Highlight | undefined,
) => {
	if (!highlighted) return selection?.kind === "node" ? 0 : 0.6;
	if (selection?.kind !== "node") return 1;
	return readHighlightOpacity(highlight?.edgeLevels.get(edgeId));
};

/** Creates the visual emphasis policy for Canvas flow nodes and routes. */
const createCanvasHighlightFx = Effect.fn("createCanvasHighlightFx")(() =>
	Effect.succeed({
		readEdgeOpacity,
		readNodeHighlight,
		readNodeOpacity,
	} as const),
);

const readPalette = (host: HTMLElement): CanvasPalette => {
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
				space: read("--ak-flow-item-simple-surface"),
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

/** Creates the reader that resolves Canvas colors from active editor theme tokens. */
const createCanvasPaletteFx = Effect.fn("createCanvasPaletteFx")(() =>
	Effect.succeed({
		readPalette,
	} as const),
);

const traceFlowRoute = (context: CanvasRenderingContext2D, points: ReadonlyArray<LayoutPoint>) => {
	const first = points[0];
	if (first === undefined) return;
	context.moveTo(first.x, first.y);
	for (const point of points.slice(1)) context.lineTo(point.x, point.y);
};

const drawArrow = (context: CanvasRenderingContext2D, from: LayoutPoint, to: LayoutPoint) => {
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
	backbone: ReadonlyArray<LayoutPoint>,
	highlightColor: string | undefined,
	opacity: number,
	palette: CanvasPalette,
) => {
	const first = backbone[0];
	if (first === undefined) return;
	const emphasized = highlightColor !== undefined;
	const edgeColor = highlightColor ?? palette.lineStrong;

	context.save();
	context.globalAlpha = opacity;
	context.lineJoin = "miter";
	context.lineCap = "butt";
	context.strokeStyle = edgeColor;
	context.fillStyle = edgeColor;
	context.lineWidth = emphasized ? 2 : 1;
	context.beginPath();
	traceFlowRoute(context, backbone);
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
	context.beginPath();
	for (let x = offsetX; x <= width; x += gap)
		for (let y = offsetY; y <= height; y += gap) {
			context.moveTo(x + 1, y);
			context.arc(x, y, 1, 0, Math.PI * 2);
		}
	context.fill();
	context.restore();
};

/** Creates the Canvas painter for origin-flow routes and the viewport grid. */
const createCanvasRoutePainterFx = Effect.fn("createCanvasRoutePainterFx")(() =>
	Effect.succeed({
		drawEdge,
		drawGrid,
	} as const),
);

/** Assembles the Canvas node, route, and visual-emphasis painters. */
export const createCanvasPainterFx = Effect.fn("createCanvasPainterFx")(function* () {
	const nodePainter = yield* createCanvasNodePainterFx();
	const palette = yield* createCanvasPaletteFx();
	const routePainter = yield* createCanvasRoutePainterFx();
	const highlight = yield* createCanvasHighlightFx();
	return {
		...highlight,
		...nodePainter,
		...palette,
		...routePainter,
	} as const;
});
