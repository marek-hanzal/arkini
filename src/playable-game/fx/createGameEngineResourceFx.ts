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
			const assertUsableFn = () => {
				if (criticalFailure !== null) throw criticalFailure;
			};
			const markCriticalFailureFn = (
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
				for (const listenerFn of [
					...criticalFailureListeners,
				])
					listenerFn();
				return criticalFailure;
			};
			const publishSessionFatalFn = () => {
				if (explicitFailurePublication) return;
				const fatal = game.getFatalErrorFn();
				if (fatal === null) return;
				markCriticalFailureFn(
					fatal.source === "autosave"
						? "game-save"
						: fatal.source === "presentation"
							? "game-presentation"
							: "game-runtime",
					fatal,
				);
			};
			publishSessionFatalFn();
			game.subscribeFatalErrorFn(publishSessionFatalFn);
			const reportCriticalFailureFn: GameEngine["reportCriticalFailureFn"] = (
				operation,
				cause,
			) => {
				explicitFailurePublication = true;
				let fatal: GameSessionFatalError;
				try {
					fatal = game.failStopFn(
						operation === "game-presentation" ? "presentation" : "runtime",
						cause,
					);
				} finally {
					explicitFailurePublication = false;
				}
				markCriticalFailureFn(operation, fatal);
			};
			const readOrThrowFn = <Result, Error, Requirements extends GameSessionServices>(
				effect: Effect.Effect<Result, Error, Requirements>,
			): Result => {
				assertUsableFn();
				const exit = game.readFn(effect);
				if (Exit.isFailure(exit)) {
					const failure = readExactCauseFailureFn(exit.cause);
					explicitFailurePublication = true;
					let fatal: GameSessionFatalError;
					try {
						fatal = game.failStopFn(
							"runtime",
							Option.isSome(failure) ? failure.value : exit.cause,
						);
					} finally {
						explicitFailurePublication = false;
					}
					throw markCriticalFailureFn("game-read", fatal);
				}
				return exit.value;
			};
			const engine: GameEngine<GameType> = {
				...game,
				readOrThrowFn,
				reportCriticalFailureFn,
			};
			return {
				game: engine,
				getCriticalFailureFn: () => criticalFailure,
				assertUsableFn,
				markCriticalFailureFn,
				subscribeCriticalFailureFn: (listenerFn) => {
					criticalFailureListeners.add(listenerFn);
					return () => {
						criticalFailureListeners.delete(listenerFn);
					};
				},
			} satisfies GameEngineResource<GameType>;
		}),
);
