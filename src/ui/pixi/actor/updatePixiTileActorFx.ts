import { Effect } from "effect";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { loadPixiTileActorTexturesFx } from "~/ui/pixi/actor/loadPixiTileActorTexturesFx";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";
import { fitPixiSingleLineTextFx } from "~/ui/pixi/text/fitPixiSingleLineTextFx";

export namespace updatePixiTileActorFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly textures: PixiTextureStore;
	}
}

const tileToSlotRatio = 0.8;

/** Mutates retained display objects only when canonical visual data or layout changed. */
export const updatePixiTileActorFx = Effect.fn("updatePixiTileActorFx")(function* ({
	actor,
	frames,
	item,
	palette,
	size,
	textures,
}: updatePixiTileActorFx.Props) {
	const texturesChanged =
		actor.item.sourceUrl !== item.sourceUrl || actor.item.compositeUrl !== item.compositeUrl;
	const inset = (size * (1 - tileToSlotRatio)) / 2;
	const faceSize = Math.max(1, size - inset * 2);
	const titlePaddingX = faceSize * 0.06;
	const titlePaddingY = Math.max(2, faceSize * 0.025);
	const titleFontSize = Math.max(9, Math.min(18, faceSize * 0.13));
	const badgeFontSize = Math.max(9, Math.min(18, faceSize * 0.14));

	actor.item = item;
	if (!actor.dragging) {
		actor.container.cursor = yield* readPixiTileActorCursorFx({
			phase: "idle",
			previewKind: null,
			running: item.running,
		});
	}
	if (texturesChanged) {
		yield* loadPixiTileActorTexturesFx({
			actor,
			frames,
			textures,
		});
	}
	actor.size = size;
	actor.container.hitArea = {
		contains: (x: number, y: number) => x >= 0 && x <= size && y >= 0 && y <= size,
	};
	for (const sprite of [
		actor.primary,
		actor.composite,
	]) {
		sprite.x = inset;
		sprite.y = inset;
		sprite.width = faceSize;
		sprite.height = faceSize;
	}

	actor.titleStyle.fontSize = titleFontSize;
	actor.title.text = yield* fitPixiSingleLineTextFx({
		maxWidth: faceSize - titlePaddingX * 2,
		style: actor.titleStyle,
		text: item.title,
	});
	actor.title.x = inset + titlePaddingX;
	actor.title.y = inset + faceSize - actor.title.height - titlePaddingY * 2;
	actor.titleBackground
		.clear()
		.roundRect(
			inset + titlePaddingX * 0.5,
			actor.title.y - titlePaddingY,
			faceSize - titlePaddingX,
			actor.title.height + titlePaddingY * 2,
			Math.max(3, faceSize * 0.055),
		)
		.fill({
			alpha: 0.78,
			color: palette.overlay,
		});

	actor.quantity.style.fontSize = badgeFontSize;
	actor.quantity.text = String(item.quantity);
	actor.quantity.visible = item.quantity > 1;
	actor.quantityBackground.visible = item.quantity > 1;
	if (item.quantity > 1) {
		const badgePaddingX = Math.max(4, faceSize * 0.055);
		const badgePaddingY = Math.max(2, faceSize * 0.02);
		const badgeWidth = actor.quantity.width + badgePaddingX * 2;
		const badgeHeight = actor.quantity.height + badgePaddingY * 2;
		const badgeX = inset + faceSize - badgeWidth - faceSize * 0.05;
		const badgeY = inset + faceSize * 0.05;
		actor.quantity.x = badgeX + badgePaddingX;
		actor.quantity.y = badgeY + badgePaddingY;
		actor.quantityBackground
			.clear()
			.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2)
			.fill({
				alpha: 0.86,
				color: palette.overlay,
			});
	}
	actor.crowdLayer.alpha = item.running ? 0.82 : 1;
	yield* frames.invalidateFx;
});
