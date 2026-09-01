import { useCallback, useRef } from "react";

import {
	ItemOriginItemInputPortId,
	ItemOriginItemOutputPortId,
	type ItemOriginItemNode,
	type ItemOriginOperationKind,
} from "~/flow/type/ItemOriginFlow";
import type { CanvasPalette } from "~/flow-canvas/type/CanvasPalette";
import { useCanvasTextPainter } from "~/flow-canvas/ui/useCanvasTextPainter";
import {
	OperationContentPadding,
	OperationHeaderHeight,
	OperationSidePadding,
	type NodeMetrics,
} from "~/flow-layout/fn/readNodeMetricsFn";
import type { LayoutNode } from "~/flow-layout/type/Layout";
import { useTranslator } from "~/translation/ui/useTranslator";

const readItemTypeColorFn = (palette: CanvasPalette, type: ItemOriginItemNode["type"]) => {
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

const readSourceKindColorFn = (palette: CanvasPalette, kind: ItemOriginOperationKind) => {
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

const SourceKindIconPath: Record<ItemOriginOperationKind, string> = {
	line: "M12 16h.01M16 16h.01M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zm5-3h.01",
	charges:
		"m11 7-3 5h4l-3 5m5.856-11H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935M22 14v-4M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936",
	merge: "M14 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1m5-7a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1M7 15l3 3m-3 3 3-3H5a2 2 0 0 1-2-2v-2",
	expiry: "M10 2h4m-2 12 3-3",
};

type DrawCanvasItemArtwork = (
	context: CanvasRenderingContext2D,
	node: ItemOriginItemNode,
	resourceUrls: ReadonlyMap<string, string>,
	x: number,
	y: number,
	size: number,
	palette: CanvasPalette,
) => void;

interface DrawCanvasItemNodeProps {
	readonly connectedPortIds: ReadonlySet<string> | undefined;
	readonly context: CanvasRenderingContext2D;
	readonly highlight: "active" | "idle" | "selected";
	readonly highlightedPortColors: ReadonlyMap<string, string> | undefined;
	readonly metrics: NodeMetrics;
	readonly node: ItemOriginItemNode;
	readonly opacity: number;
	readonly palette: CanvasPalette;
	readonly position: LayoutNode;
	readonly resourceUrls: ReadonlyMap<string, string>;
}

/** Owns the stable item-card drawing callback and icon cache for one Flow Canvas renderer. */
export const useCanvasItemNodePainter = (drawItemArtworkFn: DrawCanvasItemArtwork) => {
	const textPainter = useCanvasTextPainter();
	const translator = useTranslator();
	const sourceIconPathCacheRef = useRef<Map<ItemOriginOperationKind, Path2D>>(new Map());

	return useCallback(
		({
			connectedPortIds,
			context,
			highlight,
			highlightedPortColors,
			metrics,
			node,
			opacity,
			palette,
			position,
			resourceUrls,
		}: DrawCanvasItemNodeProps) => {
			const typeColor = readItemTypeColorFn(palette, node.type);
			context.save();
			context.globalAlpha = opacity;
			context.beginPath();
			context.rect(position.x, position.y, position.width, position.height);
			context.fillStyle = palette.itemSurfaces[node.type];
			context.fill();
			context.lineWidth = highlight === "selected" ? 4 : highlight === "active" ? 2.5 : 2;
			context.strokeStyle = highlight === "idle" ? typeColor : palette.accent;
			context.stroke();

			if (connectedPortIds?.has(ItemOriginItemInputPortId) === true) {
				context.beginPath();
				context.arc(position.x, position.y + metrics.itemPortY, 6, 0, Math.PI * 2);
				context.fillStyle =
					highlightedPortColors?.get(ItemOriginItemInputPortId) ??
					palette.itemSurfaces[node.type];
				context.fill();
				context.lineWidth = 2.5;
				context.strokeStyle =
					highlightedPortColors?.get(ItemOriginItemInputPortId) ?? typeColor;
				context.stroke();
			}
			if (connectedPortIds?.has(ItemOriginItemOutputPortId) === true) {
				context.beginPath();
				context.arc(
					position.x + position.width,
					position.y + metrics.itemPortY,
					6,
					0,
					Math.PI * 2,
				);
				context.fillStyle =
					highlightedPortColors?.get(ItemOriginItemOutputPortId) ??
					palette.itemSurfaces[node.type];
				context.fill();
				context.lineWidth = 2.5;
				context.strokeStyle =
					highlightedPortColors?.get(ItemOriginItemOutputPortId) ?? typeColor;
				context.stroke();
			}

			const artworkSize = 68;
			const artworkX = position.x + 16;
			const artworkY = position.y + (metrics.headerHeight - artworkSize) / 2;
			drawItemArtworkFn(
				context,
				node,
				resourceUrls,
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
			const titleLines = textPainter.wrapTextFn(context, node.title, maxTextWidth, 2);
			context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
			const idLines = textPainter.wrapIdentifierFn(context, node.itemId, maxTextWidth, 2);
			const textHeight =
				titleLines.length * titleLineHeight +
				blockGap +
				idLines.length * idLineHeight +
				blockGap +
				labelLineHeight;
			let textY = position.y + (metrics.headerHeight - textHeight) / 2;

			context.fillStyle = palette.foreground;
			context.font = "600 15px Inter, ui-sans-serif, system-ui, sans-serif";
			textPainter.drawLinesFn(context, titleLines, textX, textY, titleLineHeight);
			textY += titleLines.length * titleLineHeight + blockGap;

			context.fillStyle = palette.muted;
			context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
			textPainter.drawLinesFn(context, idLines, textX, textY, idLineHeight);
			textY += idLines.length * idLineHeight + blockGap;

			context.font = "600 10px Inter, ui-sans-serif, system-ui, sans-serif";
			const label =
				node.starterScopes.length > 0
					? `Starter: ${node.starterScopes.join(", ")}`
					: node.type === "missing"
						? translator.textFn("Item type - missing")
						: translator.textFn(`Item type - ${node.type}`);
			context.fillText(
				textPainter.fitTextFn(context, label.toUpperCase(), maxTextWidth),
				textX,
				textY,
			);

			if (node.operations.length > 0) {
				context.beginPath();
				context.moveTo(position.x + 12, position.y + metrics.headerHeight - 1);
				context.lineTo(
					position.x + position.width - 12,
					position.y + metrics.headerHeight - 1,
				);
				context.strokeStyle = palette.lineStrong;
				context.globalAlpha *= 0.35;
				context.lineWidth = 1;
				context.stroke();
				context.globalAlpha = opacity;
			}

			for (const [operationIndex, operation] of node.operations.entries()) {
				const operationMetrics = metrics.operations[operationIndex];
				if (operationMetrics === undefined) continue;
				const kindColor = readSourceKindColorFn(palette, operation.kind);
				const rowX = position.x + OperationSidePadding;
				const rowY = position.y + operationMetrics.top;
				const rowWidth = position.width - OperationSidePadding * 2;
				const rowHeight = operationMetrics.height;
				context.beginPath();
				context.roundRect(rowX, rowY, rowWidth, rowHeight, 10);
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
				let iconPath = sourceIconPathCacheRef.current.get(operation.kind);
				if (iconPath === undefined) {
					iconPath = new Path2D(SourceKindIconPath[operation.kind]);
					sourceIconPathCacheRef.current.set(operation.kind, iconPath);
				}
				context.save();
				context.translate(headerX, headerCenterY - iconSize / 2);
				context.scale(iconSize / 24, iconSize / 24);
				context.strokeStyle = kindColor;
				context.lineWidth = 2;
				context.lineCap = "round";
				context.lineJoin = "round";
				context.stroke(iconPath);
				if (operation.kind === "merge") {
					context.beginPath();
					context.roundRect(14, 14, 7, 7, 1);
					context.roundRect(3, 3, 7, 7, 1);
					context.stroke();
				} else if (operation.kind === "expiry") {
					context.beginPath();
					context.arc(12, 14, 8, 0, Math.PI * 2);
					context.stroke();
				}
				context.restore();

				context.fillStyle = palette.foreground;
				context.font = "600 12px Inter, ui-sans-serif, system-ui, sans-serif";
				context.textBaseline = "middle";
				context.textAlign = "left";
				context.fillText(
					textPainter.fitTextFn(
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
					if (connectedPortIds?.has(input.id) === true) {
						context.beginPath();
						context.arc(position.x, worldY, 6, 0, Math.PI * 2);
						context.fillStyle =
							highlightedPortColors?.get(input.id) ?? palette.itemSurfaces[node.type];
						context.fill();
						context.lineWidth = 2.5;
						context.strokeStyle = highlightedPortColors?.get(input.id) ?? kindColor;
						context.stroke();
					}
					context.fillStyle = palette.foreground;
					context.textAlign = "left";
					context.textBaseline = "middle";
					context.fillText(
						textPainter.fitTextFn(context, input.label, 104),
						rowX + OperationContentPadding,
						worldY,
					);
				}
				for (const output of operation.outputs) {
					const portY = operationMetrics.outputPortYs.get(output.id);
					if (portY === undefined) continue;
					const worldY = position.y + portY;
					if (connectedPortIds?.has(output.id) === true) {
						context.beginPath();
						context.arc(position.x + position.width, worldY, 6, 0, Math.PI * 2);
						context.fillStyle =
							highlightedPortColors?.get(output.id) ??
							palette.itemSurfaces[node.type];
						context.fill();
						context.lineWidth = 2.5;
						context.strokeStyle = highlightedPortColors?.get(output.id) ?? kindColor;
						context.stroke();
					}
					context.fillStyle = palette.foreground;
					context.textAlign = "right";
					context.textBaseline = "middle";
					context.fillText(
						textPainter.fitTextFn(context, output.label, 104),
						rowX + rowWidth - OperationContentPadding,
						worldY,
					);
				}
			}
			context.textAlign = "start";
			context.restore();
		},
		[
			drawItemArtworkFn,
			textPainter,
			translator,
		],
	);
};
