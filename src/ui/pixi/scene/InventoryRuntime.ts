import type { Effect } from "effect";

import type { GameTransition } from "~/renderer/game/session/GameSession";

export interface InventoryRuntime {
	readonly canvas: HTMLCanvasElement;
	readonly cancelInteractionFx: Effect.Effect<void>;
	readonly projectSpaceActivationFx: (transition: GameTransition) => Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
