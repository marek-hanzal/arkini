import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import { RendererRuntime } from "~/renderer/RendererRuntime";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import { readParticleLightSurfaceFx } from "~/ui/pixi/appearance/readParticleLightSurfaceFx";
import type { ParticleTextures } from "~/ui/pixi/actor/ParticleTextures";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createActivityParticlesFx } from "~/ui/pixi/actor/createActivityParticlesFx";
import { createActorVisualFx } from "~/ui/pixi/actor/createActorVisualFx";
import { readActorCursorFx } from "~/ui/pixi/actor/readActorCursorFx";
import { readCrowdAlphaFx } from "~/ui/pixi/actor/readCrowdAlphaFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";

export namespace createTileActorFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly particleTextures?: Pick<ParticleTextures, "star">;
		readonly textures: TextureStore;
	}
}

let nextActorInstance = 0;

/** Creates one retained native Pixi actor; async textures are generation guarded. */
export const createTileActorFx = Effect.fn("createTileActorFx")(
	({ frames, item, palette, particleTextures, textures }: createTileActorFx.Props) =>
		Effect.gen(function* (): Effect.fn.Return<PixiTileActor> {
			nextActorInstance += 1;
			const instanceId = `pixi-tile:${nextActorInstance}`;
			const container = new Container({
				eventMode: "static",
				label: `TileActor:${item.id}:${instanceId}`,
			});
			container.cursor = RendererRuntime.runSync(
				readActorCursorFx({
					phase: "idle",
					previewKind: null,
					running: item.running,
				}),
			);
			const lifecycleLayer = new Container({
				eventMode: "none",
				label: `TileActorLifecycle:${item.id}:${instanceId}`,
			});
			const offsetLayer = new Container({
				eventMode: "none",
				label: `TileActorOffset:${item.id}:${instanceId}`,
			});
			const crowdLayer = new Container({
				eventMode: "none",
				label: `TileActorCrowd:${item.id}:${instanceId}`,
			});
			crowdLayer.alpha = yield* readCrowdAlphaFx(item);
			const visualLayer = new Container({
				eventMode: "none",
				label: `TileActorVisualLayer:${item.id}:${instanceId}`,
			});
			const activityParticles = yield* createActivityParticlesFx({
				actorId: item.id,
				instanceId,
				lightSurface: yield* readParticleLightSurfaceFx(palette),
				textures: particleTextures,
				tint: palette.accent,
			});
			activityParticles.container.blendMode = "normal";
			const progressBar = new Graphics({
				eventMode: "none",
				label: `TileActorProgress:${item.id}:${instanceId}`,
			});
			progressBar.visible = false;
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
			offsetLayer.addChild(crowdLayer, activityParticles.container, progressBar);
			lifecycleLayer.addChild(offsetLayer);
			container.addChild(lifecycleLayer);

			return {
				instanceId,
				container,
				lifecycleLayer,
				offsetLayer,
				crowdLayer,
				visualLayer,
				activityParticles,
				progressBar,
				visuals,
				currentVisual,
				pendingVisual: null,
				item,
				size: 0,
				visualTransitionGeneration: 0,
				lifecycleIntentGeneration: 0,
				lifecycleTransitionStarted: false,
				lifecycleTargetAlpha: 1,
				lifecycleNotBeforeMs: 0,
				lifecycleDurationMs: 0,
				dragging: false,
				dragOffsetX: 0,
				dragOffsetY: 0,
				onPointerDown: null,
			} satisfies PixiTileActor;
		}),
);
