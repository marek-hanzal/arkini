import { Effect } from "effect";
import { Container, Graphics, Rectangle } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import { createActorVisualFx } from "~/tile-rendering/fx/createActorVisualFx";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";
import type { TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

export namespace createTileActorFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly textures: TextureStore;
	}
}

let nextActorInstance = 0;

/** Creates one retained native Pixi actor; async textures are generation guarded. */
export const createTileActorFx = Effect.fn("createTileActorFx")(
	({ frames, item, palette, textures }: createTileActorFx.Props) =>
		Effect.gen(function* (): Effect.fn.Return<PixiTileActor> {
			nextActorInstance += 1;
			const instanceId = `pixi-tile:${nextActorInstance}`;
			const container = new Container({
				eventMode: "static",
				label: `TileActor:${item.id}:${instanceId}`,
			});
			container.cursor = readActorCursorFn({
				phase: "idle",
				running: item.running,
			});
			const lifecycleLayer = new Container({
				eventMode: "none",
				label: `TileActorLifecycle:${item.id}:${instanceId}`,
			});
			const hoverLayer = new Container({
				eventMode: "none",
				label: `TileActorHover:${item.id}:${instanceId}`,
			});
			const visualLayer = new Container({
				eventMode: "none",
				label: `TileActorVisualLayer:${item.id}:${instanceId}`,
			});
			const progressBar = new Graphics({
				eventMode: "none",
				label: `TileActorProgress:${item.id}:${instanceId}`,
			});
			progressBar.visible = false;
			const clockRing = new Graphics({
				eventMode: "none",
				label: `TileActorClock:${item.id}:${instanceId}`,
			});
			clockRing.visible = false;
			const infoButton = new Container({
				eventMode: "static",
				label: `TileActorInfo:${item.id}:${instanceId}`,
			});
			const infoShadow = new Graphics({
				eventMode: "none",
			});
			infoShadow
				.circle(0, 0, 11)
				.stroke({
					color: palette.overlay,
					width: 1.6,
				})
				.circle(0, -5, 1.5)
				.fill(palette.overlay)
				.roundRect(-1.5, -1.5, 3, 8, 1.2)
				.fill(palette.overlay);
			const infoGlyph = new Graphics({
				eventMode: "none",
			});
			infoGlyph
				.circle(0, 0, 11)
				.stroke({
					color: palette.foreground,
					alpha: 0.8,
					width: 1.6,
				})
				.circle(0, -5, 1.5)
				.fill(palette.foreground)
				.roundRect(-1.5, -1.5, 3, 8, 1.2)
				.fill(palette.foreground);
			infoButton.addChild(infoShadow, infoGlyph);
			infoButton.hitArea = new Rectangle(-17, -17, 34, 34);
			infoButton.cursor = "pointer";
			infoButton.visible = false;
			const currentVisual = yield* createActorVisualFx({
				frames,
				item,
				palette,
				size: 0,
				textures,
			});
			const visuals = new Set([
				currentVisual,
			]);
			visualLayer.addChild(currentVisual.container);
			hoverLayer.addChild(visualLayer, progressBar, clockRing);
			lifecycleLayer.addChild(hoverLayer);
			container.addChild(lifecycleLayer, infoButton);

			return {
				instanceId,
				container,
				lifecycleLayer,
				hoverLayer,
				infoButton,
				infoShadow,
				visualLayer,
				progressBar,
				clockRing,
				visuals,
				currentVisual,
				pendingVisual: null,
				item,
				size: 0,
				visualTransitionGeneration: 0,
				dragging: false,
				dragOffsetX: 0,
				dragOffsetY: 0,
				onPointerDownFn: null,
				onPointerEnterFn: null,
				onPointerLeaveFn: null,
			} satisfies PixiTileActor;
		}),
);
