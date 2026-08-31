import { Effect, Exit, Option } from "effect";

import {
	CriticalGameLifecycleError,
	type CriticalGameLifecycleOperation,
} from "~/playable-game/error/CriticalGameLifecycleError";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { GameEngineResource } from "~/playable-game/type/GameEngineResource";
import type { GameSessionServices } from "~/game-session/type/GameSession";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import type { GameSessionFatalError } from "~/game-session/error/GameSessionFatalError";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";

/** Wraps one exact playable session in a presentation fail-stop guard. */
export const createGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")(
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
				let fatal: GameSessionFatalError;
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
					const failure = readExactCauseFailureFn(exit.cause);
					explicitFailurePublication = true;
					let fatal: GameSessionFatalError;
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
