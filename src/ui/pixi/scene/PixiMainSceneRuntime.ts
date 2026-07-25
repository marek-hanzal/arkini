import type { Effect } from "effect";

export interface PixiMainSceneRuntime {
	readonly canvas: HTMLCanvasElement;
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
