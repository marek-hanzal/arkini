import type { Effect } from "effect";

/** Main Board canvas lifetime and interaction capability. */
export interface MainRuntime {
	readonly canvas: HTMLCanvasElement;
	readonly cancelInteractionFx: Effect.Effect<void, never, never>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
