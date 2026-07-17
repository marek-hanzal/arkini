import type { Effect } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

export namespace GameOwner {
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
				readonly packageId: string | null;
				readonly error: unknown;
				readonly canForceShutdown: boolean;
				readonly saveRecoveryKey?: GameSaveStorage.Key;
		  };

	export interface Props {
		readonly createFx: (packageId: string) => Effect.Effect<Game, unknown>;
		readonly clearSaveFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown>;
	}
}

/** Stable renderer-facing owner of one serialized, replaceable live game. */
export interface GameOwner {
	readonly getSnapshot: () => GameOwner.State;
	readonly replaceFx: (packageId: string | null) => Effect.Effect<void, unknown>;
	readonly clearFailedSaveAndRetryFx: () => Effect.Effect<void, unknown>;
	readonly hardResetFx: () => Effect.Effect<void, unknown>;
	readonly forceShutdownFx: () => Effect.Effect<void, unknown>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
}
