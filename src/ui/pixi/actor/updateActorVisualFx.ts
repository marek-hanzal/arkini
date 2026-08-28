import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import { fitSingleLineTextFx } from "~/ui/pixi/text/fitSingleLineTextFx";
import { formatTileBadgeLabelFx } from "~/ui/tile/formatTileBadgeLabelFx";
import { readArtworkLayoutFx } from "~/ui/pixi/actor/readArtworkLayoutFx";

export namespace updateActorVisualFx {
	export interface Props {
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly visual: ActorVisual;
	}
}

const tileToSlotRatio = 0.8;
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
	const artwork = yield* readArtworkLayoutFx({
		faceSize,
		inset,
		layered: item.compositeUrl !== undefined,
	});
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
			: yield* formatTileBadgeLabelFx({
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
