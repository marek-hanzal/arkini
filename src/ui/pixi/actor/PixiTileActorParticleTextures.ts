import type { Effect } from "effect";
import type { Texture } from "pixi.js";

/** Scene-owned procedural atlas slices shared by every tile particle container. */
export interface PixiTileActorParticleTextures {
	readonly mote: Texture;
	readonly spark: Texture;
	readonly closeFx: Effect.Effect<void>;
}
