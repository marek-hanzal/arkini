import { Effect } from "effect";

import { createCanvasHighlightFx } from "~/flow/ui/createCanvasHighlightFx";
import { createCanvasNodePainterFx } from "~/flow/ui/createCanvasNodePainterFx";
import { createCanvasPaletteFx } from "~/flow/ui/createCanvasPaletteFx";
import { createCanvasRoutePainterFx } from "~/flow/ui/createCanvasRoutePainterFx";
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
