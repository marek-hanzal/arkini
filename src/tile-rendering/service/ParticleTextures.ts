import type { Effect } from "effect";
import type { Texture } from "pixi.js";

/** Scene-owned procedural atlas slices shared by every tile particle container. */
export interface ParticleTextures {
	readonly star: Texture;
	readonly closeFx: Effect.Effect<void, never, never>;
}
