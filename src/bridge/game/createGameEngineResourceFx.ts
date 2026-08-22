import { Effect, Exit, Option } from "effect";

import {
	CriticalGameLifecycleError,
	type CriticalGameLifecycleOperation,
} from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import type { GameSessionServices } from "~/bridge/game/GameSession";
import type { PlayableGame } from "~/bridge/game/PlayableGame";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";

/** Wraps one exact playable session in a presentation fail-stop guard. */
const makeGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")(
	<GameType extends PlayableGame>(game: GameType) =>
		Effect.sync(() => {
			let criticalFailure: CriticalGameLifecycleError | null = null;
			let explicitFailurePublication = false;
			const criticalFailureListeners = new Set<() => void>();
			const assertUsable = () => {
				if (criticalFailure !== null) throw criticalFailure;
			};
			const markCriticalFailure = (
				operation: CriticalGameLifecycleOperation,
				cause: unknown,
			) => {
				if (criticalFailure !== null) return criticalFailure;
				criticalFailure =
					cause instanceof CriticalGameLifecycleError
						? cause
						: new CriticalGameLifecycleError({
								operation,
								cause,
							});
				for (const listener of [
					...criticalFailureListeners,
				])
					listener();
				return criticalFailure;
			};
			const publishSessionFatal = () => {
				if (explicitFailurePublication) return;
				const fatal = game.getFatalError();
				if (fatal === null) return;
				markCriticalFailure(
					fatal.source === "autosave"
						? "game-save"
						: fatal.source === "presentation"
							? "game-presentation"
							: "game-runtime",
					fatal,
				);
			};
			publishSessionFatal();
			game.subscribeFatalError(publishSessionFatal);
			const reportCriticalFailure: GameEngine["reportCriticalFailure"] = (
				operation,
				cause,
			) => {
				explicitFailurePublication = true;
				let fatal: ReturnType<PlayableGame["failStop"]>;
				try {
					fatal = game.failStop(
						operation === "game-presentation" ? "presentation" : "runtime",
						cause,
					);
				} finally {
					explicitFailurePublication = false;
				}
				markCriticalFailure(operation, fatal);
			};
			const readOrThrow = <Result, Error, Requirements extends GameSessionServices>(
				effect: Effect.Effect<Result, Error, Requirements>,
			): Result => {
				assertUsable();
				const exit = game.read(effect);
				if (Exit.isFailure(exit)) {
					const failureExit = game.read(readExactCauseFailureFx(exit.cause));
					const failure = Exit.isSuccess(failureExit) ? failureExit.value : Option.none();
					explicitFailurePublication = true;
					let fatal: ReturnType<PlayableGame["failStop"]>;
					try {
						fatal = game.failStop(
							"runtime",
							Option.isSome(failure) ? failure.value : exit.cause,
						);
					} finally {
						explicitFailurePublication = false;
					}
					throw markCriticalFailure("game-read", fatal);
				}
				return exit.value;
			};
			const engine: GameEngine<GameType> = {
				...game,
				readOrThrow,
				reportCriticalFailure,
			};
			return {
				game: engine,
				getCriticalFailure: () => criticalFailure,
				assertUsable,
				markCriticalFailure,
				subscribeCriticalFailure: (listener) => {
					criticalFailureListeners.add(listener);
					return () => {
						criticalFailureListeners.delete(listener);
					};
				},
			} satisfies GameEngineResource<GameType>;
		}),
);

export function createGameEngineResourceFx(game: Game): Effect.Effect<GameEngineResource<Game>>;
export function createGameEngineResourceFx<GameType extends PlayableGame>(
	game: GameType,
): Effect.Effect<GameEngineResource<GameType>>;
export function createGameEngineResourceFx(
	game: PlayableGame,
): Effect.Effect<GameEngineResource<PlayableGame>> {
	return makeGameEngineResourceFx(game);
}
