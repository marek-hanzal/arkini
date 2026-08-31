import { useMemo } from "react";

import type { CanvasPalette } from "~/flow-canvas/type/CanvasPalette";
import type { Viewport } from "~/flow-canvas/type/Viewport";
import type { LayoutPoint } from "~/flow-layout/type/Layout";

interface CanvasRoutePainter {
	readonly drawEdgeFn: (
		context: CanvasRenderingContext2D,
		backbone: ReadonlyArray<LayoutPoint>,
		highlightColor: string | undefined,
		opacity: number,
		palette: CanvasPalette,
	) => void;
	readonly drawGridFn: (
		context: CanvasRenderingContext2D,
		width: number,
		height: number,
		viewport: Viewport,
		palette: CanvasPalette,
	) => void;
}

/** Owns the stable route and grid drawing callbacks for one Flow Canvas renderer. */
export const useCanvasRoutePainter = (): CanvasRoutePainter =>
	useMemo(
		() => ({
			drawEdgeFn: (context, backbone, highlightColor, opacity, palette) => {
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
				context.moveTo(first.x, first.y);
				for (const point of backbone.slice(1)) context.lineTo(point.x, point.y);
				context.stroke();

				const last = backbone.at(-1)!;
				const previous = backbone.at(-2) ?? first;
				const angle = Math.atan2(last.y - previous.y, last.x - previous.x);
				const length = 8;
				context.beginPath();
				context.moveTo(last.x, last.y);
				context.lineTo(
					last.x - Math.cos(angle - Math.PI / 6) * length,
					last.y - Math.sin(angle - Math.PI / 6) * length,
				);
				context.lineTo(
					last.x - Math.cos(angle + Math.PI / 6) * length,
					last.y - Math.sin(angle + Math.PI / 6) * length,
				);
				context.closePath();
				context.fill();
				context.restore();
			},
			drawGridFn: (context, width, height, viewport, palette) => {
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
			},
		}),
		[],
	);
