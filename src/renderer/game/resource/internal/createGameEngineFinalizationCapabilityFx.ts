import { Deferred, Effect, Exit, Option, Ref, Scope, type Semaphore } from "effect";

import type { CriticalGameLifecycleError } from "~/renderer/game/resource/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/renderer/game/resource/GameEngineResource";
import type { GameEngineResourceFxService } from "~/renderer/game/resource/GameEngineResourceFx";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";
import type {
	Finalization,
	GameEngineResourceServiceState,
} from "~/renderer/game/resource/internal/GameEngineResourceServiceState";

export namespace createGameEngineFinalizationCapabilityFx {
	export interface Dependencies {
		readonly clearSaveFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown>;
		readonly lifecycle: Semaphore.Semaphore;
		readonly operationScope: Scope.Scope;
		readonly stateRef: Ref.Ref<GameEngineResourceServiceState>;
	}

	export interface Capability {
		readonly finalizeFx: (
			resource: GameEngineResource,
			operation: Finalization["operation"],
			actionFx: Effect.Effect<void, unknown>,
			allowAlreadyFinalized: boolean,
			joinInFlightOperation?: boolean,
		) => Effect.Effect<void, unknown>;
		readonly releaseFx: GameEngineResourceFxService["releaseFx"];
		readonly resetFx: GameEngineResourceFxService["resetFx"];
	}
}

/**
 * Owns terminal Game finalization. A failed operation permanently settles the
 * renderer authority with one canonical critical error; it is never retried.
 */
export const createGameEngineFinalizationCapabilityFx = Effect.fn(
	"createGameEngineFinalizationCapabilityFx",
)(
	({
		clearSaveFx,
		lifecycle,
		operationScope,
		stateRef,
	}: createGameEngineFinalizationCapabilityFx.Dependencies) =>
		Effect.gen(function* () {
			const withLifecycleLockFx = Effect.fn("GameEngineFinalizationFx.withLifecycleLockFx")(
				<Result, Error, Requirements>(effect: Effect.Effect<Result, Error, Requirements>) =>
					lifecycle.withPermits(1)(effect),
			);

			const completeFinalizationFx = Effect.fn(
				"GameEngineFinalizationFx.completeFinalizationFx",
			)((finalization: Finalization, exit: Exit.Exit<void, CriticalGameLifecycleError>) =>
				withLifecycleLockFx(
					Effect.gen(function* () {
						const state = yield* Ref.get(stateRef);
						if (state._tag === "Finalizing" && state.finalization === finalization) {
							yield* Ref.set(
								stateRef,
								Exit.isSuccess(exit)
									? {
											_tag: "Idle",
											lastFinalized: finalization.resource,
										}
									: {
											_tag: "OwnershipFailed",
											error: Option.getOrThrow(
												readExactCauseFailureFn(exit.cause),
											),
											finalization,
										},
							);
						}
						yield* Deferred.done(finalization.completion, exit);
					}),
				),
			);

			const canonicalFinalizationExitFx = Effect.fn(
				"GameEngineFinalizationFx.canonicalFinalizationExitFx",
			)((finalization: Finalization, exit: Exit.Exit<void, unknown>) =>
				Effect.gen(function* () {
					if (Exit.isSuccess(exit)) return Exit.void;
					const failure = readExactCauseFailureFn(exit.cause);
					return Exit.fail(
						finalization.resource.markCriticalFailure(
							finalization.operation === "release" ? "game-leave" : "game-reset",
							Option.isSome(failure) ? failure.value : exit.cause,
						),
					);
				}),
			);

			const runFinalizationFx = Effect.fn("GameEngineFinalizationFx.runFinalizationFx")(
				(finalization: Finalization, actionFx: Effect.Effect<void, unknown>) =>
					actionFx.pipe(
						Effect.exit,
						Effect.flatMap((exit) => canonicalFinalizationExitFx(finalization, exit)),
						Effect.flatMap((exit) => completeFinalizationFx(finalization, exit)),
					),
			);

			const finalizeFx = Effect.fn("GameEngineFinalizationFx.finalizeFx")(
				(
					resource: GameEngineResource,
					operation: Finalization["operation"],
					actionFx: Effect.Effect<void, unknown>,
					allowAlreadyFinalized: boolean,
					joinInFlightOperation = false,
				): Effect.Effect<void, unknown> =>
					Effect.suspend(() =>
						Effect.uninterruptibleMask((restore) =>
							withLifecycleLockFx(
								Effect.gen(function* () {
									const state = yield* Ref.get(stateRef);
									if (state._tag === "Idle") {
										return state.lastFinalized === resource &&
											allowAlreadyFinalized
											? ({
													_tag: "Done",
												} as const)
											: ({
													_tag: "Failure",
													cause: new Error(
														"Game Engine cleanup cannot remove a different or missing singleton resource.",
													),
												} as const);
									}
									if (state._tag === "OwnershipFailed") {
										return joinInFlightOperation &&
											state.finalization?.resource === resource
											? ({
													_tag: "Wait",
													completion: state.finalization.completion,
												} as const)
											: ({
													_tag: "Failure",
													cause: state.error,
												} as const);
									}
									if (state._tag === "Finalizing") {
										return state.finalization.resource === resource &&
											(state.finalization.operation === operation ||
												joinInFlightOperation)
											? ({
													_tag: "Wait",
													completion: state.finalization.completion,
												} as const)
											: ({
													_tag: "Failure",
													cause: new Error(
														"Game Engine cleanup cannot remove a different or missing singleton resource.",
													),
												} as const);
									}
									if (state._tag !== "Active" || state.resource !== resource) {
										return {
											_tag: "Failure",
											cause: new Error(
												"Game Engine cleanup cannot remove a different or missing singleton resource.",
											),
										} as const;
									}
									const completion = yield* Deferred.make<
										void,
										CriticalGameLifecycleError
									>();
									const finalization = {
										resource,
										operation,
										completion,
									} satisfies Finalization;
									yield* Ref.set(stateRef, {
										_tag: "Finalizing",
										finalization,
									});
									yield* Effect.forkIn(
										restore(runFinalizationFx(finalization, actionFx)),
										operationScope,
									);
									return {
										_tag: "Lead",
										completion,
									} as const;
								}),
							),
						),
					).pipe(
						Effect.flatMap((decision) => {
							switch (decision._tag) {
								case "Done":
									return Effect.void;
								case "Failure":
									return Effect.fail(decision.cause);
								case "Lead":
								case "Wait":
									return Deferred.await(decision.completion);
							}
						}),
					),
			);

			const releaseFx: GameEngineResourceFxService["releaseFx"] = Effect.fn(
				"GameEngineResourceFx.releaseFx",
			)(({ allowAlreadyFinalized = false, resource }) =>
				finalizeFx(
					resource,
					"release",
					Effect.suspend(() => resource.game.disposeFx),
					allowAlreadyFinalized,
				),
			);

			const resetFx: GameEngineResourceFxService["resetFx"] = Effect.fn(
				"GameEngineResourceFx.resetFx",
			)(({ resource }) =>
				finalizeFx(
					resource,
					"reset",
					Effect.suspend(() => resource.game.disposeWithoutSaveFx).pipe(
						Effect.andThen(Effect.suspend(() => clearSaveFx(resource.game.saveKey))),
					),
					false,
				),
			);

			return {
				finalizeFx,
				releaseFx,
				resetFx,
			} satisfies createGameEngineFinalizationCapabilityFx.Capability;
		}),
);
