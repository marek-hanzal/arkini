import { Effect } from "effect";

import { createCanvasHighlightFx } from "~/ui/item/editor/origin-flow/createCanvasHighlightFx";
import { createCanvasNodePainterFx } from "~/ui/item/editor/origin-flow/createCanvasNodePainterFx";
import { createCanvasPaletteFx } from "~/ui/item/editor/origin-flow/createCanvasPaletteFx";
import { createCanvasRoutePainterFx } from "~/ui/item/editor/origin-flow/createCanvasRoutePainterFx";
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
