import type { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";

export interface MainReconciler {
	readonly hydrateFx: (
		transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
	) => Effect.Effect<void>;
	readonly reconcileFx: (
		transition: ReturnType<GameEngine["getTransitionSnapshot"]>,
	) => Effect.Effect<void>;
	readonly refreshVisualsFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<void>;
}
