import { Effect } from "effect";
import { type Sprite, Texture } from "pixi.js";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { PixiTileActor } from "~/ui/pixi/actor/PixiTileActor";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";
import type { PixiTextureStore } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

export namespace loadPixiTileActorTexturesFx {
	export interface Props {
		readonly actor: PixiTileActor;
		readonly frames: DemandFrameLoop;
		readonly textures: PixiTextureStore;
	}
}

/** Starts generation-guarded texture loads for one retained actor. */
export const loadPixiTileActorTexturesFx = Effect.fn("loadPixiTileActorTexturesFx")(
	({ actor, frames, textures }: loadPixiTileActorTexturesFx.Props) =>
		Effect.sync(() => {
			const generation = ++actor.textureGeneration;
			const loadTexture = (url: string, target: Sprite) => {
				void RendererRuntime.runPromise(textures.loadFx(url))
					.then((texture) => {
						if (actor.container.destroyed || actor.textureGeneration !== generation) {
							return;
						}
						target.texture = texture;
						RendererRuntime.runSync(frames.invalidateFx);
					})
					.catch((cause) => {
						console.error(`Pixi tile texture failed to load: ${url}`, cause);
					});
			};
			actor.primary.texture = Texture.EMPTY;
			actor.composite.texture = Texture.EMPTY;
			loadTexture(actor.item.sourceUrl, actor.primary);
			if (actor.item.compositeUrl !== undefined) {
				loadTexture(actor.item.compositeUrl, actor.composite);
			}
		}),
);
