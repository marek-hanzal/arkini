import { Cause, Deferred, Effect, Exit, Fiber, Option, Ref, Scope, type Semaphore } from "effect";

import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type {
	AcquisitionOwner,
	Cancellation,
	GameEngineResourceServiceState,
	LeaseRecord,
} from "~/installed-game/fx/lifecycle/GameEngineResourceServiceState";

export namespace createGameEngineCancellationCapabilityFx {
	export interface Dependencies {
		readonly lifecycle: Semaphore.Semaphore;
		readonly operationScope: Scope.Scope;
		readonly stateRef: Ref.Ref<GameEngineResourceServiceState>;
	}

	export interface Capability {
		readonly beginCancellationFx: (
			owner: AcquisitionOwner,
			force: boolean,
		) => Effect.Effect<void, CriticalGameLifecycleError>;
		readonly releaseCloseClaimFx: (
			owner: AcquisitionOwner,
			token: symbol,
		) => Effect.Effect<void, CriticalGameLifecycleError>;
		readonly releaseLeaseRecordFx: (record: LeaseRecord) => Effect.Effect<void>;
	}
}

/** Owns acquisition cancellation and exact provisional-resource cleanup. */
export const createGameEngineCancellationCapabilityFx = Effect.fn(
	"createGameEngineCancellationCapabilityFx",
)(
	({
		lifecycle,
		operationScope,
		stateRef,
	}: createGameEngineCancellationCapabilityFx.Dependencies) =>
		Effect.gen(function* () {
			const withLifecycleLockFx = Effect.fn("GameEngineCancellationFx.withLifecycleLockFx")(
				<Result, Error, Requirements>(effect: Effect.Effect<Result, Error, Requirements>) =>
					lifecycle.withPermits(1)(effect),
			);

			const completeCancellationFx = Effect.fn(
				"GameEngineCancellationFx.completeCancellationFx",
			)((cancellation: Cancellation, exit: Exit.Exit<void, CriticalGameLifecycleError>) =>
				withLifecycleLockFx(
					Effect.gen(function* () {
						const state = yield* Ref.get(stateRef);
						if (state._tag === "Cancelling" && state.cancellation === cancellation) {
							const failure = Exit.isFailure(exit)
								? readExactCauseFailureFn(exit.cause)
								: Option.none();
							yield* Ref.set(
								stateRef,
								Exit.isSuccess(exit)
									? {
											_tag: "Idle",
											lastFinalized: undefined,
										}
									: {
											_tag: "OwnershipFailed",
											error:
												Option.isSome(failure) &&
												failure.value instanceof CriticalGameLifecycleError
													? failure.value
													: new CriticalGameLifecycleError({
															operation: "engine-ownership",
															cause: Option.isSome(failure)
																? failure.value
																: exit.cause,
														}),
											finalization: undefined,
										},
							);
						}
						yield* Deferred.done(cancellation.completion, exit);
					}),
				),
			);

			const runCancellationFx = Effect.fn("GameEngineCancellationFx.runCancellationFx")(
				(cancellation: Cancellation) =>
					Effect.gen(function* () {
						const owner = cancellation.owner;
						if (owner.fiber !== undefined) {
							yield* Fiber.interrupt(owner.fiber);
						}
						const fiberExit =
							owner.fiber === undefined
								? Exit.failCause(Cause.interrupt())
								: yield* Fiber.await(owner.fiber);
						const resource =
							owner.resource ??
							(Exit.isSuccess(fiberExit) ? fiberExit.value : undefined);
						if (resource === undefined) return;
						const disposeExit = yield* Effect.exit(
							Effect.suspend(() => resource.game.disposeWithoutSaveFx),
						);
						if (Exit.isFailure(disposeExit)) {
							const failure = readExactCauseFailureFn(disposeExit.cause);
							return yield* Effect.fail(
								resource.markCriticalFailure(
									"engine-ownership",
									Option.isSome(failure) ? failure.value : disposeExit.cause,
								),
							);
						}
					}).pipe(
						Effect.exit,
						Effect.flatMap((exit) => completeCancellationFx(cancellation, exit)),
					),
			);

			const beginCancellationFx = Effect.fn("GameEngineCancellationFx.beginCancellationFx")(
				(owner: AcquisitionOwner, force: boolean) =>
					Effect.uninterruptibleMask((restore) =>
						withLifecycleLockFx(
							Effect.gen(function* () {
								const state = yield* Ref.get(stateRef);
								if (
									state._tag === "Cancelling" &&
									state.cancellation.owner === owner
								) {
									return state.cancellation.completion;
								}
								const exactOwner =
									(state._tag === "Acquiring" || state._tag === "Provisional") &&
									state.owner === owner;
								if (!exactOwner) return null;
								if (
									!force &&
									(owner.closeClaims.size > 0 || owner.consumers.size > 0)
								) {
									return null;
								}
								const completion = yield* Deferred.make<
									void,
									CriticalGameLifecycleError
								>();
								const cancellation = {
									owner,
									completion,
								} satisfies Cancellation;
								yield* Ref.set(stateRef, {
									_tag: "Cancelling",
									cancellation,
								});
								yield* Effect.forkIn(
									restore(runCancellationFx(cancellation)),
									operationScope,
								);
								return completion;
							}),
						),
					).pipe(
						Effect.flatMap((completion) =>
							completion === null ? Effect.void : Deferred.await(completion),
						),
					),
			);

			const releaseOwnerClaimFx = Effect.fn("GameEngineCancellationFx.releaseOwnerClaimFx")(
				(owner: AcquisitionOwner, release: () => void) =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							release();
							const state = yield* Ref.get(stateRef);
							return (
								(state._tag === "Acquiring" || state._tag === "Provisional") &&
								state.owner === owner &&
								owner.closeClaims.size === 0 &&
								owner.consumers.size === 0
							);
						}),
					).pipe(
						Effect.flatMap((cancel) =>
							cancel ? beginCancellationFx(owner, false) : Effect.void,
						),
					),
			);

			const releaseLeaseRecordFx = Effect.fn("GameEngineCancellationFx.releaseLeaseRecordFx")(
				(record: LeaseRecord) => {
					if (record.owner === undefined) return Effect.void;
					const owner = record.owner;
					return releaseOwnerClaimFx(owner, () => {
						owner.consumers.delete(record.token);
					}).pipe(Effect.catch(() => Effect.void));
				},
			);

			const releaseCloseClaimFx = Effect.fn("GameEngineCancellationFx.releaseCloseClaimFx")(
				(owner: AcquisitionOwner, token: symbol) =>
					releaseOwnerClaimFx(owner, () => {
						owner.closeClaims.delete(token);
					}),
			);

			return {
				beginCancellationFx,
				releaseCloseClaimFx,
				releaseLeaseRecordFx,
			} satisfies createGameEngineCancellationCapabilityFx.Capability;
		}),
);
