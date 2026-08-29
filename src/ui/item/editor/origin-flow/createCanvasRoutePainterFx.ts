import { Effect } from "effect";

import type { LayoutPoint } from "~/ui/item/editor/origin-flow/Layout";
import type { Viewport } from "~/ui/item/editor/origin-flow/Viewport";
import type { CanvasPalette } from "~/ui/item/editor/origin-flow/CanvasPalette";

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
export const createCanvasRoutePainterFx = Effect.fn("createCanvasRoutePainterFx")(() =>
	Effect.succeed({
		drawEdge,
		drawGrid,
	} as const),
);
