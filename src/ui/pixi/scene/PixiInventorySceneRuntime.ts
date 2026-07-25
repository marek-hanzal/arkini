import type { Effect } from "effect";

export interface PixiInventorySceneRuntime {
	readonly canvas: HTMLCanvasElement;
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
