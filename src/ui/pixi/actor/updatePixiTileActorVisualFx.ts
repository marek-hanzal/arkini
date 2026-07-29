import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import { fitPixiSingleLineTextFx } from "~/ui/pixi/text/fitPixiSingleLineTextFx";
import { formatTileBadgeLabel } from "~/ui/tile/formatTileBadgeCount";

export namespace updatePixiTileActorVisualFx {
	export interface Props {
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly visual: PixiTileActorVisual;
	}
}

const tileToSlotRatio = 0.8;

/** Applies one complete logical face revision to one private visual slot. */
export const updatePixiTileActorVisualFx = Effect.fn("updatePixiTileActorVisualFx")(function* ({
	item,
	palette,
	size,
	visual,
}: updatePixiTileActorVisualFx.Props) {
	const inset = (size * (1 - tileToSlotRatio)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
	const titlePaddingX = faceSize * 0.06;
	const titlePaddingY = Math.max(2, faceSize * 0.025);
	const titleFontSize = Math.max(9, Math.min(18, faceSize * 0.13));
	const badgeFontSize = Math.max(9, Math.min(18, faceSize * 0.14));

	visual.item = item;
	visual.size = size;
	for (const sprite of [
		visual.primary,
		visual.composite,
	]) {
		sprite.x = inset;
		sprite.y = inset;
		sprite.width = faceSize;
		sprite.height = faceSize;
	}

	visual.titleStyle.fontSize = titleFontSize;
	visual.title.text = yield* fitPixiSingleLineTextFx({
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
			: formatTileBadgeLabel({
					count: item.badgeCount,
					kind: item.badgeKind,
				});
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
