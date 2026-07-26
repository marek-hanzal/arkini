import type { Effect } from "effect";
import type { Texture } from "pixi.js";

export interface PixiTileActorRunningGlowTexture {
	readonly texture: Texture;
	readonly closeFx: Effect.Effect<void>;
}
