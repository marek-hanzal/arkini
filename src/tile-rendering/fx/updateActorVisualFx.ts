import { Effect } from "effect";
import { CanvasTextMetrics, type TextStyle } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { ActorVisual } from "~/tile-rendering/type/ActorVisual";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";

export namespace updateActorVisualFx {
	export interface Props {
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly visual: ActorVisual;
	}
}

interface FitSingleLineTextProps {
	readonly maxWidth: number;
	readonly style: TextStyle;
	readonly text: string;
}

const ellipsis = "…";

/** Measures one actor-owned title and returns its exact single-line projection. */
const fitSingleLineTextFx = Effect.fn("fitSingleLineTextFx")(
	({ maxWidth, style, text }: FitSingleLineTextProps) =>
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

const tileToSlotRatio = 0.8;
const layeredArtworkToFaceRatio = 0.75;
const formatTileBadgeLabelFn = (count: number, kind?: "queue") =>
	`${kind === "queue" ? "x" : ""}${count > 99 ? "99+" : String(count)}`;

/** Applies one complete logical face revision to one private visual slot. */
export const updateActorVisualFx = Effect.fn("updateActorVisualFx")(function* ({
	item,
	palette,
	size,
	visual,
}: updateActorVisualFx.Props) {
	const inset = (size * (1 - tileToSlotRatio)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
	const titlePaddingX = faceSize * 0.06;
	const titlePaddingY = Math.max(2, faceSize * 0.025);
	const titleFontSize = Math.max(9, Math.min(18, faceSize * 0.13));
	const badgeFontSize = Math.max(9, Math.min(18, faceSize * 0.14));

	visual.item = item;
	visual.size = size;
	const artworkSize =
		item.compositeUrl === undefined ? faceSize : faceSize * layeredArtworkToFaceRatio;
	const artwork = {
		primary: {
			x: inset,
			y: inset,
			size: artworkSize,
		},
		secondary: {
			x: inset + faceSize - artworkSize,
			y: inset + faceSize - artworkSize,
			size: artworkSize,
		},
	};
	visual.primary.x = artwork.primary.x;
	visual.primary.y = artwork.primary.y;
	visual.primary.width = artwork.primary.size;
	visual.primary.height = artwork.primary.size;
	visual.composite.x = artwork.secondary.x;
	visual.composite.y = artwork.secondary.y;
	visual.composite.width = artwork.secondary.size;
	visual.composite.height = artwork.secondary.size;

	visual.titleStyle.fontSize = titleFontSize;
	visual.title.text = yield* fitSingleLineTextFx({
		maxWidth: faceSize - titlePaddingX * 2,
		style: visual.titleStyle,
		text: item.title,
	});
	visual.title.x = inset + titlePaddingX;
	visual.title.y = inset + faceSize - visual.title.height - titlePaddingY * 2;
	visual.titleBackground
		.clear()
		.roundRect(
			inset + titlePaddingX * 0.5,
			visual.title.y - titlePaddingY,
			faceSize - titlePaddingX,
			visual.title.height + titlePaddingY * 2,
			Math.max(3, faceSize * 0.055),
		)
		.fill({
			alpha: 0.78,
			color: palette.overlay,
		});

	visual.quantity.style.fontSize = badgeFontSize;
	visual.quantity.text =
		item.badgeCount === undefined
			? ""
			: formatTileBadgeLabelFn(item.badgeCount, item.badgeKind);
	visual.quantity.visible = item.badgeCount !== undefined;
	visual.quantityBackground.visible = item.badgeCount !== undefined;
	if (item.badgeCount !== undefined) {
		const badgePaddingX = Math.max(4, faceSize * 0.055);
		const badgePaddingY = Math.max(2, faceSize * 0.02);
		const badgeWidth = visual.quantity.width + badgePaddingX * 2;
		const badgeHeight = visual.quantity.height + badgePaddingY * 2;
		const badgeX = inset + faceSize - badgeWidth - faceSize * 0.05;
		const badgeY = inset + faceSize * 0.05;
		visual.quantity.x = badgeX + badgePaddingX;
		visual.quantity.y = badgeY + badgePaddingY;
		visual.quantityBackground
			.clear()
			.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2)
			.fill({
				alpha: 0.86,
				color: palette.overlay,
			});
	}
});
