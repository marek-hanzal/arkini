import type { Effect } from "effect";

import type { GameTransition } from "~/game-session/type/GameSession";

/** Routed Inventory canvas lifetime and transition projection capability. */
export interface InventoryRuntime {
	readonly canvas: HTMLCanvasElement;
	readonly cancelInteractionFx: Effect.Effect<void, never, never>;
	readonly projectSpaceActivationFx: (
		transition: GameTransition,
	) => Effect.Effect<void, never, never>;
	readonly closeFx: Effect.Effect<void, never, never>;
}
