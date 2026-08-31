import { Deferred, Effect, Exit, Option, Ref, Scope, type Semaphore } from "effect";

import type { GameEngineResourceFxService } from "~/installed-game/service/GameEngineResourceFx";
import { GameSaveBootstrapError } from "~/installed-game/error/GameSaveBootstrapError";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type {
	FailedSaveRecovery,
	GameEngineResourceServiceState,
} from "~/installed-game/type/GameEngineResourceServiceState";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

export namespace createFailedSaveRecoveryCapabilityFx {
	export interface Dependencies {
		readonly clearSaveFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown, never>;
		readonly lifecycle: Semaphore.Semaphore;
		readonly operationScope: Scope.Scope;
		readonly stateRef: Ref.Ref<GameEngineResourceServiceState>;
	}

	export interface Capability {
		readonly discardFailedFx: GameEngineResourceFxService["discardFailedFx"];
		readonly recoverFailedSaveFx: GameEngineResourceFxService["recoverFailedSaveFx"];
	}
}

/** Owns the only allowed in-process recovery: one exact verified bootstrap save failure. */
export const createFailedSaveRecoveryCapabilityFx = Effect.fn(
	"createFailedSaveRecoveryCapabilityFx",
)(
	({
		clearSaveFx,
		lifecycle,
		operationScope,
		stateRef,
	}: createFailedSaveRecoveryCapabilityFx.Dependencies) =>
		Effect.gen(function* () {
			const withLifecycleLockFx = Effect.fn("FailedSaveRecoveryFx.withLifecycleLockFx")(
				<Result, Error, Requirements>(effect: Effect.Effect<Result, Error, Requirements>) =>
					lifecycle.withPermits(1)(effect),
			);

			const discardFailedFx: GameEngineResourceFxService["discardFailedFx"] = Effect.fn(
				"GameEngineResourceFx.discardFailedFx",
			)((packageId) =>
				withLifecycleLockFx(
					Effect.gen(function* () {
						const state = yield* Ref.get(stateRef);
						if (state._tag === "OwnershipFailed") {
							return yield* Effect.fail(state.error);
						}
						if (state._tag !== "BootstrapFailed" || state.packageId !== packageId) {
							return yield* Effect.fail(
								new Error(
									"Failed Game exit requires one exact failed bootstrap resource.",
								),
							);
						}
						const exactFailure = readExactCauseFailureFn(state.cause);
						const failure: Option.Option<GameSaveBootstrapError> =
							Option.isSome(exactFailure) &&
							exactFailure.value instanceof GameSaveBootstrapError
								? Option.some(exactFailure.value)
								: Option.none();
						if (Option.isSome(failure)) {
							return yield* Effect.fail(
								new Error(
									"Verified save failures require exact save cleanup before exit.",
								),
							);
						}
						yield* Ref.set(stateRef, {
							_tag: "Idle",
							lastFinalized: undefined,
						});
					}),
				),
			);

			const completeFailedSaveRecoveryFx = Effect.fn(
				"FailedSaveRecoveryFx.completeFailedSaveRecoveryFx",
			)((recovery: FailedSaveRecovery, exit: Exit.Exit<void, unknown>) =>
				withLifecycleLockFx(
					Effect.gen(function* () {
						const state = yield* Ref.get(stateRef);
						if (state._tag === "RecoveringFailedSave" && state.recovery === recovery) {
							yield* Ref.set(
								stateRef,
								Exit.isSuccess(exit)
									? {
											_tag: "Idle",
											lastFinalized: undefined,
										}
									: {
											_tag: "BootstrapFailed",
											packageId: recovery.packageId,
											cause: recovery.bootstrapCause,
										},
							);
						}
						yield* Deferred.done(recovery.completion, exit);
					}),
				),
			);

			const runFailedSaveRecoveryFx = Effect.fn(
				"FailedSaveRecoveryFx.runFailedSaveRecoveryFx",
			)((recovery: FailedSaveRecovery) =>
				clearSaveFx(recovery.error.saveKey).pipe(
					Effect.exit,
					Effect.flatMap((exit) => completeFailedSaveRecoveryFx(recovery, exit)),
				),
			);

			const recoverFailedSaveFx: GameEngineResourceFxService["recoverFailedSaveFx"] =
				Effect.fn("GameEngineResourceFx.recoverFailedSaveFx")(({ packageId }) =>
					Effect.uninterruptibleMask((restore) =>
						withLifecycleLockFx(
							Effect.gen(function* () {
								const state = yield* Ref.get(stateRef);
								if (state._tag === "OwnershipFailed") {
									return {
										_tag: "Failure",
										cause: state.error,
									} as const;
								}
								if (state._tag === "RecoveringFailedSave") {
									return state.recovery.packageId === packageId
										? ({
												_tag: "Wait",
												completion: state.recovery.completion,
											} as const)
										: ({
												_tag: "Failure",
												cause: new Error(
													"Game save recovery package identity does not match its failed resource.",
												),
											} as const);
								}
								if (state._tag !== "BootstrapFailed") {
									return {
										_tag: "Failure",
										cause: new Error(
											"Game save recovery requires an exact verified bootstrap save failure.",
										),
									} as const;
								}
								const exactFailure = readExactCauseFailureFn(state.cause);
								const failure: Option.Option<GameSaveBootstrapError> =
									Option.isSome(exactFailure) &&
									exactFailure.value instanceof GameSaveBootstrapError
										? Option.some(exactFailure.value)
										: Option.none();
								if (Option.isNone(failure)) {
									return {
										_tag: "Failure",
										cause: new Error(
											"Game save recovery requires an exact verified bootstrap save failure.",
										),
									} as const;
								}
								if (
									state.packageId !== packageId ||
									failure.value.saveKey.packageId !== packageId
								) {
									return {
										_tag: "Failure",
										cause: new Error(
											"Game save recovery package identity does not match its failed resource.",
										),
									} as const;
								}
								const completion = yield* Deferred.make<void, unknown>();
								const recovery = {
									packageId,
									bootstrapCause: state.cause,
									error: failure.value,
									completion,
								} satisfies FailedSaveRecovery;
								yield* Ref.set(stateRef, {
									_tag: "RecoveringFailedSave",
									recovery,
								});
								yield* Effect.forkIn(
									restore(runFailedSaveRecoveryFx(recovery)),
									operationScope,
								);
								return {
									_tag: "Lead",
									completion,
								} as const;
							}),
						),
					).pipe(
						Effect.flatMap((decision) => {
							switch (decision._tag) {
								case "Failure":
									return Effect.fail(decision.cause);
								case "Lead":
								case "Wait":
									return Deferred.await(decision.completion);
							}
						}),
					),
				);

			return {
				discardFailedFx,
				recoverFailedSaveFx,
			} satisfies createFailedSaveRecoveryCapabilityFx.Capability;
		}),
);
