import { Effect } from "effect";

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

const layeredArtworkToFaceRatio = 0.75;
const formatTileBadgeLabelFn = (count: number, kind?: "units" | "queue") =>
	`${kind === "queue" ? "x" : ""}${count > 99 ? "99+" : String(count)}`;

/** Applies one complete logical face revision to one private visual slot. */
export const updateActorVisualFx = Effect.fn("updateActorVisualFx")(function* ({
	item,
	palette,
	size,
	visual,
}: updateActorVisualFx.Props) {
	const inset = (size * (1 - item.artworkScale)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
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
