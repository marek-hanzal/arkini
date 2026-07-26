import { Effect } from "effect";
import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { loadPixiTileActorTexturesFx } from "~/ui/pixi/actor/loadPixiTileActorTexturesFx";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

export namespace createPixiTileActorFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly textures: PixiTextureStore;
	}
}

/** Creates one retained native Pixi actor; async textures are generation guarded. */
export const createPixiTileActorFx = Effect.fn("createPixiTileActorFx")(
	({ frames, item, palette, textures }: createPixiTileActorFx.Props) =>
		Effect.sync((): PixiTileActor => {
			const container = new Container({
				eventMode: "static",
				label: `TileActor:${item.id}`,
			});
			container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					previewKind: null,
					running: item.running,
				}),
			);
			const crowdLayer = new Container({
				eventMode: "none",
				label: `TileActorCrowd:${item.id}`,
			});
			crowdLayer.alpha = item.running ? 0.82 : 1;
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
			crowdLayer.addChild(
				primary,
				composite,
				titleBackground,
				title,
				quantityBackground,
				quantity,
			);
			container.addChild(crowdLayer);

			const actor: PixiTileActor = {
				container,
				crowdLayer,
				primary,
				composite,
				title,
				titleBackground,
				quantity,
				quantityBackground,
				titleStyle,
				item,
				size: 0,
				textureGeneration: 0,
				dragging: false,
				dragOffsetX: 0,
				dragOffsetY: 0,
				onPointerDown: null,
			};

			RendererRuntime.runSync(
				loadPixiTileActorTexturesFx({
					actor,
					frames,
					textures,
				}),
			);
			return actor;
		}),
);
