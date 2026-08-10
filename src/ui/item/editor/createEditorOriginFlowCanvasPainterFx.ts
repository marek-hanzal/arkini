import { Effect } from "effect";

import { createEditorOriginFlowCanvasHighlightFx } from "~/ui/item/editor/createEditorOriginFlowCanvasHighlightFx";
import { createEditorOriginFlowCanvasNodePainterFx } from "~/ui/item/editor/createEditorOriginFlowCanvasNodePainterFx";
import { createEditorOriginFlowCanvasPaletteFx } from "~/ui/item/editor/createEditorOriginFlowCanvasPaletteFx";
import { createEditorOriginFlowCanvasRoutePainterFx } from "~/ui/item/editor/createEditorOriginFlowCanvasRoutePainterFx";
import type { EditorOriginFlowCanvasPalette } from "~/ui/item/editor/EditorOriginFlowCanvasPalette";

export type { EditorOriginFlowCanvasPalette };

/** Assembles the Canvas node, route, and visual-emphasis painters. */
export const createEditorOriginFlowCanvasPainterFx = Effect.fn(
	"createEditorOriginFlowCanvasPainterFx",
)(function* () {
	const nodePainter = yield* createEditorOriginFlowCanvasNodePainterFx();
	const palette = yield* createEditorOriginFlowCanvasPaletteFx();
	const routePainter = yield* createEditorOriginFlowCanvasRoutePainterFx();
	const highlight = yield* createEditorOriginFlowCanvasHighlightFx();
	return {
		...highlight,
		...nodePainter,
		...palette,
		...routePainter,
	} as const;
});
