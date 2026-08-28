import { Effect, Exit, Option } from "effect";

import {
	CriticalGameLifecycleError,
	type CriticalGameLifecycleOperation,
} from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngine } from "~/bridge/game/GameEngine";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import type { GameEngineServices } from "~/bridge/game/GameSession";
import type { PlayableGame } from "~/bridge/game/PlayableGame";
import { readExactCauseFailureFx } from "~/bridge/game/readExactCauseFailureFx";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";

/** Wraps one exact playable session in a presentation fail-stop guard. */
export const createGameEngineResourceFx = Effect.fn("createGameEngineResourceFx")(
	<SessionType extends PlayableGame, Metadata extends GameEngine.Metadata>({
		session,
		resourceMetadata,
	}: {
		readonly session: SessionType;
		readonly resourceMetadata: Metadata;
	}) =>
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
				const fatal = session.getFatalError();
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
			session.subscribeFatalError(publishSessionFatal);
			const reportCriticalFailure: GameEngine["reportCriticalFailure"] = (
				operation,
				cause,
			) => {
				explicitFailurePublication = true;
				let fatal: ReturnType<PlayableGame["failStop"]>;
				try {
					fatal = session.failStop(
						operation === "game-presentation" ? "presentation" : "runtime",
						cause,
					);
				} finally {
					explicitFailurePublication = false;
				}
				markCriticalFailure(operation, fatal);
			};
			const readOrThrow = <Result, Error, Requirements extends GameEngineServices>(
				effect: Effect.Effect<Result, Error, Requirements>,
			): Result => {
				assertUsable();
				const exit = session.read(effect);
				if (Exit.isFailure(exit)) {
					const failureExit = session.read(readExactCauseFailureFx(exit.cause));
					const failure = Exit.isSuccess(failureExit) ? failureExit.value : Option.none();
					explicitFailurePublication = true;
					let fatal: ReturnType<PlayableGame["failStop"]>;
					try {
						fatal = session.failStop(
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
			const engine: GameEngine<Metadata> = {
				resourceMetadata,
				diagnosticSessionId: session.diagnosticSessionId,
				config: session.config,
				getResourceUrl: session.getResourceUrl,
				committedTransitionAtom: session.committedTransitionAtom,
				getTransitionSnapshot: session.getTransitionSnapshot,
				subscribeTransitions: session.subscribeTransitions,
				subscribeEvents: session.subscribeEvents,
				readOrThrow,
				reportCriticalFailure,
				runEngineFx: session.runFx,
				saveFx: session.runFx(
					RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush)),
				),
			};
			return {
				session,
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
			} satisfies GameEngineResource<SessionType, Metadata>;
		}),
);
