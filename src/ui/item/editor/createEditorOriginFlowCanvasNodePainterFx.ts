import { Effect } from "effect";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperationKind,
} from "~/bridge/item/editor/EditorItemOriginFlow";
import { ItemTypeLabel } from "~/ui/item-detail/ItemInfoPresentation";
import type { EditorItemOriginFlowLayoutNode } from "~/ui/item/editor/editorItemOriginFlowLayout";
import { createEditorOriginFlowCanvasArtworkPainterFx } from "~/ui/item/editor/createEditorOriginFlowCanvasArtworkPainterFx";
import { createEditorOriginFlowCanvasTextPainterFx } from "~/ui/item/editor/createEditorOriginFlowCanvasTextPainterFx";
import type { EditorOriginFlowCanvasPalette } from "~/ui/item/editor/EditorOriginFlowCanvasPalette";
import {
	EditorOriginFlowOperationContentPadding,
	EditorOriginFlowOperationHeaderHeight,
	EditorOriginFlowOperationSidePadding,
	type EditorOriginFlowNodeMetrics,
} from "~/ui/item/editor/readEditorOriginFlowNodeMetricsFx";

const readItemTypeColor = (
	palette: EditorOriginFlowCanvasPalette,
	type: EditorItemOriginItemNode["type"],
) => {
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
	palette: EditorOriginFlowCanvasPalette,
	kind: EditorItemOriginOperationKind,
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
	position: EditorItemOriginFlowLayoutNode,
	radius: number,
	background: string,
	idleBorder: string,
	highlight: "active" | "idle" | "selected",
	palette: EditorOriginFlowCanvasPalette,
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
		FlowTextPainter: Effect.Success<
			ReturnType<typeof createEditorOriginFlowCanvasTextPainterFx>
		>,
		FlowArtworkPainter: Effect.Success<
			ReturnType<typeof createEditorOriginFlowCanvasArtworkPainterFx>
		>,
	) =>
	(
		context: CanvasRenderingContext2D,
		node: EditorItemOriginItemNode,
		position: EditorItemOriginFlowLayoutNode,
		metrics: EditorOriginFlowNodeMetrics,
		highlight: "active" | "idle" | "selected",
		opacity: number,
		palette: EditorOriginFlowCanvasPalette,
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
			context.globalAlpha = opacity;

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
				FlowTextPainter.fitText(
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
						highlightedPortColors?.get(input.id),
					);
				context.fillStyle = palette.foreground;
				context.textAlign = "left";
				context.textBaseline = "middle";
				context.fillText(
					FlowTextPainter.fitText(context, input.label, 104),
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
						highlightedPortColors?.get(output.id),
					);
				context.fillStyle = palette.foreground;
				context.textAlign = "right";
				context.textBaseline = "middle";
				context.fillText(
					FlowTextPainter.fitText(context, output.label, 104),
					rowX + rowWidth - EditorOriginFlowOperationContentPadding,
					worldY,
				);
			}
		}
		context.textAlign = "start";
		context.restore();
	};

/** Creates the token-aware Canvas painter for editor origin-flow item nodes. */
export const createEditorOriginFlowCanvasNodePainterFx = Effect.fn(
	"createEditorOriginFlowCanvasNodePainterFx",
)(function* () {
	const FlowTextPainter = yield* createEditorOriginFlowCanvasTextPainterFx();
	const FlowArtworkPainter = yield* createEditorOriginFlowCanvasArtworkPainterFx();
	return {
		drawItemNode: createDrawItemNode(FlowTextPainter, FlowArtworkPainter),
	} as const;
});
