import { Effect } from "effect";
import { Container, Graphics } from "pixi.js";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { PixiScenePalette } from "~/ui/pixi/appearance/PixiScenePalette";
import {
	readPixiParticleBlendMode,
	readPixiParticleLightSurface,
} from "~/ui/pixi/appearance/readPixiParticleBlendMode";
import type { PixiTileActorParticleTextures } from "~/ui/pixi/actor/PixiTileActorParticleTextures";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import { createPixiTileActorActivityParticlesFx } from "~/ui/pixi/actor/createPixiTileActorActivityParticlesFx";
import { createPixiTileActorVisualFx } from "~/ui/pixi/actor/createPixiTileActorVisualFx";
import { readPixiTileActorCursorFx } from "~/ui/pixi/actor/readPixiTileActorCursorFx";
import { readPixiTileActorCrowdAlpha } from "~/ui/pixi/actor/readPixiTileActorCrowdAlpha";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

export namespace createPixiTileActorFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly item: TileActorItem;
		readonly palette: PixiScenePalette;
		readonly particleTextures?: Pick<PixiTileActorParticleTextures, "star">;
		readonly textures: PixiTextureStore;
	}
}

let nextPixiTileActorInstance = 0;

/** Creates one retained native Pixi actor; async textures are generation guarded. */
export const createPixiTileActorFx = Effect.fn("createPixiTileActorFx")(
	({ frames, item, palette, particleTextures, textures }: createPixiTileActorFx.Props) =>
		Effect.gen(function* (): Effect.fn.Return<PixiTileActor> {
			nextPixiTileActorInstance += 1;
			const instanceId = `pixi-tile:${nextPixiTileActorInstance}`;
			const container = new Container({
				eventMode: "static",
				label: `TileActor:${item.id}:${instanceId}`,
			});
			container.cursor = RendererRuntime.runSync(
				readPixiTileActorCursorFx({
					phase: "idle",
					previewKind: null,
					running: item.running,
				}),
			);
			const offsetLayer = new Container({
				eventMode: "none",
				label: `TileActorOffset:${item.id}:${instanceId}`,
			});
			const crowdLayer = new Container({
				eventMode: "none",
				label: `TileActorCrowd:${item.id}:${instanceId}`,
			});
			crowdLayer.alpha = readPixiTileActorCrowdAlpha(item);
			const visualLayer = new Container({
				eventMode: "none",
				label: `TileActorVisualLayer:${item.id}:${instanceId}`,
			});
			const activityParticles = yield* createPixiTileActorActivityParticlesFx({
				actorId: item.id,
				instanceId,
				lightSurface: readPixiParticleLightSurface(palette),
				textures: particleTextures,
				tint: palette.accent,
			});
			activityParticles.container.blendMode = readPixiParticleBlendMode();
			const progressBar = new Graphics({
				eventMode: "none",
				label: `TileActorProgress:${item.id}:${instanceId}`,
			});
			progressBar.visible = false;
			const currentVisual = yield* createPixiTileActorVisualFx({
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
			container.addChild(offsetLayer);

			return {
				instanceId,
				container,
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
				lifecycleFadeStarted: false,
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
