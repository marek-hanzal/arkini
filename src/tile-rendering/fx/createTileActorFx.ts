import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import type { PixiTileActor } from "~/tile-rendering/type/PixiTileActor";
import type { PixiScenePalette } from "~/tile-rendering/type/PixiScenePalette";
import { createActorVisualFx } from "~/tile-rendering/fx/createActorVisualFx";
import { readActorCursorFn } from "~/tile-rendering/fn/readActorCursorFn";
import { readCrowdAlphaFn } from "~/tile-rendering/fn/readCrowdAlphaFn";
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
			const crowdLayer = new Container({
				eventMode: "none",
				label: `TileActorCrowd:${item.id}:${instanceId}`,
			});
			crowdLayer.alpha = readCrowdAlphaFn(item);
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
			crowdLayer.addChild(visualLayer);
			lifecycleLayer.addChild(crowdLayer, progressBar, clockRing);
			container.addChild(lifecycleLayer);

			return {
				instanceId,
				container,
				lifecycleLayer,
				crowdLayer,
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
			} satisfies PixiTileActor;
		}),
);
