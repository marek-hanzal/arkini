import type { Effect } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

export namespace GameOwner {
	export type Operation =
		| "select-package"
		| "route-release"
		| "shutdown"
		| "hard-reset"
		| "recover-save";

	export type State =
		| {
				readonly type: "loading";
				readonly packageId: string | null;
		  }
		| {
				readonly type: "ready";
				readonly game: Game;
		  }
		| {
				readonly type: "failed";
				readonly operation: Operation;
				readonly game: Game | null;
				readonly packageId: string | null;
				readonly error: unknown;
				readonly canRecoverSave: boolean;
		  };

	export interface Props {
		readonly createFx: (packageId: string) => Effect.Effect<Game, unknown>;
		readonly clearSaveFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown>;
	}
}

/** Stable renderer-facing owner of one serialized, replaceable live game. */
export interface GameOwner {
	readonly getSnapshot: () => GameOwner.State;
	readonly selectPackageFx: (packageId: string) => Effect.Effect<void, unknown>;
	readonly releaseRouteGameFx: () => Effect.Effect<void, unknown>;
	readonly shutdownFx: () => Effect.Effect<void, unknown>;
	readonly clearFailedSaveAndRetryFx: () => Effect.Effect<void, unknown>;
	readonly hardResetFx: () => Effect.Effect<void, unknown>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
}
