import type { Effect } from "effect";

/** Routed Inventory canvas lifetime. */
export interface InventoryRuntime {
	readonly canvas: HTMLCanvasElement;
	readonly cancelInteractionFx: Effect.Effect<void, never, never>;
	readonly setInteractionBlockedFx: (blocked: boolean) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
