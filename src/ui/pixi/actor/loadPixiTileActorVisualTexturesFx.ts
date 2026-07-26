import { Effect } from "effect";
import { Texture } from "pixi.js";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActorVisual } from "~/ui/pixi/actor/PixiTileActorVisual";
import {
	beginPixiTileActorVisualTextureLoadFx,
	completePixiTileActorVisualTextureLoadFx,
	failPixiTileActorVisualTextureLoadFx,
} from "~/ui/pixi/actor/PixiTileActorVisualReadiness";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

export namespace loadPixiTileActorVisualTexturesFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly textures: PixiTextureStore;
		readonly visual: PixiTileActorVisual;
	}
}

/**
 * Loads one complete visual revision before atomically publishing any of its texture slots.
 *
 * A failed required texture never publishes a false "ready" state. Existing actor visuals remain
 * untouched because every pending revision owns separate Sprite instances.
 */
export const loadPixiTileActorVisualTexturesFx = Effect.fn("loadPixiTileActorVisualTexturesFx")(
	({ frames, textures, visual }: loadPixiTileActorVisualTexturesFx.Props) =>
		Effect.sync(() => {
			const generation = RendererRuntime.runSync(
				beginPixiTileActorVisualTextureLoadFx(visual),
			);
			const sourceUrl = visual.item.sourceUrl;
			const compositeUrl = visual.item.compositeUrl;
			void Promise.all([
				RendererRuntime.runPromise(textures.loadFx(sourceUrl)),
				compositeUrl === undefined
					? Promise.resolve(Texture.EMPTY)
					: RendererRuntime.runPromise(textures.loadFx(compositeUrl)),
			])
				.then(([primary, composite]) => {
					if (
						visual.textureState === "destroyed" ||
						visual.textureGeneration !== generation
					) {
						return;
					}
					visual.primary.texture = primary;
					visual.composite.texture = composite;
					RendererRuntime.runSync(
						completePixiTileActorVisualTextureLoadFx({
							generation,
							visual,
						}),
					);
					RendererRuntime.runSync(frames.invalidateFx);
				})
				.catch((cause) => {
					if (
						visual.textureState === "destroyed" ||
						visual.textureGeneration !== generation
					) {
						return;
					}
					console.error(`Pixi tile visual failed to load: ${sourceUrl}`, cause);
					RendererRuntime.runSync(
						failPixiTileActorVisualTextureLoadFx({
							generation,
							visual,
						}),
					);
				});
		}),
);
