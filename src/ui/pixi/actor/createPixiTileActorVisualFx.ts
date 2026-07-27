import { Effect } from "effect";
import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";

import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import { loadPixiTileActorVisualTexturesFx } from "~/ui/pixi/actor/loadPixiTileActorVisualTexturesFx";
import { updatePixiTileActorVisualFx } from "~/ui/pixi/actor/updatePixiTileActorVisualFx";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

export namespace createPixiTileActorVisualFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly size: number;
		readonly textures: PixiTextureStore;
	}
}

/** Creates one independently loadable, atomically publishable tile face revision. */
export const createPixiTileActorVisualFx = Effect.fn("createPixiTileActorVisualFx")(function* ({
	frames,
	item,
	palette,
	size,
	textures,
}: createPixiTileActorVisualFx.Props) {
	const container = new Container({
		eventMode: "none",
		label: `TileActorVisual:${item.id}:${item.revision}`,
	});
	const primary = new Sprite(Texture.EMPTY);
	const composite = new Sprite(Texture.EMPTY);
	const titleBackground = new Graphics();
	const titleStyle = new TextStyle({
		fill: palette.overlayForeground,
		fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
		fontSize: 14,
		fontWeight: "500",
	});
	const title = new Text({
		style: titleStyle,
		text: item.title,
	});
	const quantityBackground = new Graphics();
	const quantity = new Text({
		style: {
			fill: palette.overlayForeground,
			fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
			fontSize: 14,
			fontWeight: "700",
		},
		text: String(item.quantity),
	});
	container.addChild(primary, composite, titleBackground, title, quantityBackground, quantity);
	const visual = {
		container,
		primary,
		composite,
		title,
		titleBackground,
		quantity,
		quantityBackground,
		titleStyle,
		readyListeners: new Set(),
		reportCriticalFailure: frames.reportCriticalFailure,
		item,
		size,
		textureGeneration: 0,
		textureState: "loading",
	} satisfies PixiTileActorVisual;
	yield* updatePixiTileActorVisualFx({
		item,
		palette,
		size,
		visual,
	});
	yield* loadPixiTileActorVisualTexturesFx({
		frames,
		textures,
		visual,
	});
	return visual;
});
