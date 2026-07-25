import { Effect } from "effect";
import { CanvasTextMetrics, type TextStyle } from "pixi.js";

export namespace fitPixiSingleLineTextFx {
	export interface Props {
		readonly maxWidth: number;
		readonly style: TextStyle;
		readonly text: string;
	}
}

const ellipsis = "…";

/** Applies exact measured single-line ellipsis for native Pixi text. */
export const fitPixiSingleLineTextFx = Effect.fn("fitPixiSingleLineTextFx")(
	({ maxWidth, style, text }: fitPixiSingleLineTextFx.Props) =>
		Effect.sync(() => {
			if (maxWidth <= 0) return "";
			if (CanvasTextMetrics.measureText(text, style).width <= maxWidth) return text;
			if (CanvasTextMetrics.measureText(ellipsis, style).width > maxWidth) return "";

			const graphemes = CanvasTextMetrics.graphemeSegmenter(text);
			let lower = 0;
			let upper = graphemes.length;
			while (lower < upper) {
				const middle = Math.ceil((lower + upper) / 2);
				const candidate = `${graphemes.slice(0, middle).join("")}${ellipsis}`;
				if (CanvasTextMetrics.measureText(candidate, style).width <= maxWidth) {
					lower = middle;
				} else {
					upper = middle - 1;
				}
			}
			return `${graphemes.slice(0, lower).join("")}${ellipsis}`;
		}),
);
