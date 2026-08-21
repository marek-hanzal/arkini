import { Effect, Exit, Option } from "effect";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { Game } from "~/bridge/game/Game";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";

/** Wraps one concrete Game in the fail-stop guard owned by the renderer lifecycle service. */
export const createGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")((game: Game) =>
	Effect.sync(() => {
		let criticalFailure: CriticalGameLifecycleError | null = null;
		let explicitFailurePublication = false;
		const criticalFailureListeners = new Set<() => void>();
		const assertUsable = () => {
			if (criticalFailure !== null) throw criticalFailure;
		};
		const markCriticalFailure: GameEngineResource["markCriticalFailure"] = (
			operation,
			cause,
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
		const engine = {
			...game,
			reportCriticalFailure: (operation, cause) => {
				explicitFailurePublication = true;
				let fatal: ReturnType<Game["failStop"]>;
				try {
					fatal = game.failStop(
						operation === "game-presentation" ? "presentation" : "runtime",
						cause,
					);
				} finally {
					explicitFailurePublication = false;
				}
				markCriticalFailure(operation, fatal);
			},
			readOrThrow: (effect) => {
				assertUsable();
				const exit = game.read(effect);
				if (Exit.isFailure(exit)) {
					const failureExit = game.read(readExactCauseFailureFx(exit.cause));
					const failure = Exit.isSuccess(failureExit) ? failureExit.value : Option.none();
					explicitFailurePublication = true;
					let fatal: ReturnType<Game["failStop"]>;
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
			},
		} satisfies GameEngine;
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
		} satisfies GameEngineResource;
	}),
);
