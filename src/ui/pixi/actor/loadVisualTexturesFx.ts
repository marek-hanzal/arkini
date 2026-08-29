import { Effect } from "effect";
import { Texture } from "pixi.js";

import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { TextureStore } from "~/ui/pixi/runtime/createTextureStoreFx";

export namespace loadVisualTexturesFx {
	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly textures: TextureStore;
		readonly visual: ActorVisual;
	}
}

/**
 * Loads one complete visual revision before atomically publishing any of its texture slots.
 *
 * A failed required texture never publishes a false "ready" state. Existing actor visuals remain
 * untouched because every pending revision owns separate Sprite instances.
 */
export const loadVisualTexturesFx = Effect.fn("loadVisualTexturesFx")(
	({ frames, textures, visual }: loadVisualTexturesFx.Props) =>
		Effect.sync(() => {
			const generation = RendererRuntime.runSync(
				runVisualReadinessFx({
					kind: "begin",
					visual,
				}),
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
						runVisualReadinessFx({
							generation,
							kind: "complete",
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
					RendererRuntime.runSync(
						runVisualReadinessFx({
							generation,
							kind: "fail",
							visual,
						}),
					);
					frames.reportCriticalFailure(cause);
				});
		}),
);
