import { Cause, Deferred, Effect, Exit, Fiber, Option, Ref, Scope, Semaphore } from "effect";

import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import type { InstalledGameEngineResource } from "~/installed-game/type/Game";
import type { GameEngineLease } from "~/installed-game/service/GameEngineResourceFx";
import { GameSaveBootstrapError } from "~/installed-game/error/GameSaveBootstrapError";
import {
	GameEngineResourceFx,
	type GameEngineResourceFxService,
} from "~/installed-game/service/GameEngineResourceFx";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

interface AcquisitionOwner {
	readonly id: number;
	readonly packageId: string;
	/** Native-close claims that keep provisional acquisition alive across navigation. */
	readonly closeClaims: Set<symbol>;
	/** Scoped acquisition callers currently borrowing this exact result. */
	readonly consumers: Set<symbol>;
	readonly result: Deferred.Deferred<InstalledGameEngineResource, unknown>;
	fiber: Fiber.Fiber<InstalledGameEngineResource, unknown> | undefined;
	resource: InstalledGameEngineResource | undefined;
}

interface LeaseRecord {
	readonly owner: AcquisitionOwner | undefined;
	readonly token: symbol;
}

const LeaseRecordTypeId = Symbol("GameEngineLeaseRecord");

type InternalGameEngineLease = GameEngineLease & {
	readonly [LeaseRecordTypeId]: LeaseRecord;
};

interface Cancellation {
	readonly owner: AcquisitionOwner;
	readonly completion: Deferred.Deferred<void, CriticalGameLifecycleError>;
}

interface Finalization {
	readonly resource: InstalledGameEngineResource;
	readonly operation: "release" | "reset";
	readonly completion: Deferred.Deferred<void, CriticalGameLifecycleError>;
}

interface FailedSaveRecovery {
	readonly packageId: string;
	readonly bootstrapCause: Cause.Cause<unknown>;
	readonly error: GameSaveBootstrapError;
	readonly completion: Deferred.Deferred<void, unknown>;
}

type GameEngineResourceServiceState =
	| {
			readonly _tag: "Idle";
			readonly lastFinalized: InstalledGameEngineResource | undefined;
	  }
	| {
			readonly _tag: "Acquiring";
			readonly owner: AcquisitionOwner;
	  }
	| {
			readonly _tag: "Provisional";
			/** Fully created, but not yet adopted by the package route. */
			readonly owner: AcquisitionOwner;
			readonly resource: InstalledGameEngineResource;
	  }
	| {
			readonly _tag: "Cancelling";
			readonly cancellation: Cancellation;
	  }
	| {
			readonly _tag: "Active";
			readonly resource: InstalledGameEngineResource;
	  }
	| {
			readonly _tag: "Finalizing";
			readonly finalization: Finalization;
	  }
	| {
			readonly _tag: "BootstrapFailed";
			readonly packageId: string;
			readonly cause: Cause.Cause<unknown>;
	  }
	| {
			readonly _tag: "RecoveringFailedSave";
			readonly recovery: FailedSaveRecovery;
	  }
	| {
			readonly _tag: "OwnershipFailed";
			readonly error: CriticalGameLifecycleError;
			/**
			 * Present when ownership failed after a terminal operation started.
			 * Controlled close may only observe that exact settled result.
			 */
			readonly finalization: Finalization | undefined;
	  };

export namespace createGameEngineResourceServiceFx {
	export interface Dependencies {
		readonly clearSaveFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown, never>;
		/**
		 * Creates the resource only. This service is the sole lifecycle lock owner.
		 */
		readonly createResourceFx: (
			packageId: string,
		) => Effect.Effect<InstalledGameEngineResource, unknown, never>;
	}
}

type ClaimDecision =
	| {
			readonly _tag: "None";
	  }
	| {
			readonly _tag: "Resource";
			readonly resource: InstalledGameEngineResource;
	  }
	| {
			readonly _tag: "WaitCancellation";
			readonly completion: Deferred.Deferred<void, CriticalGameLifecycleError>;
	  }
	| {
			readonly _tag: "Owner";
			readonly owner: AcquisitionOwner;
			readonly token: symbol;
	  };

/**
 * Creates the sole serialized Game lifecycle state machine for one renderer root.
 *
 * Acquisition, cancellation, finalization and recovery are private operations
 * over this one state Ref, semaphore and operation Scope. Decisions are made
 * under the lock; slow work and completion waits execute after releasing it.
 */
export const createGameEngineResourceServiceFx = Effect.fn("createGameEngineResourceServiceFx")(
	(dependencies: createGameEngineResourceServiceFx.Dependencies) =>
		Effect.gen(function* () {
			const lifecycle = yield* Semaphore.make(1);
			const operationScope = yield* Scope.make();
			const stateRef = yield* Ref.make<GameEngineResourceServiceState>({
				_tag: "Idle",
				lastFinalized: undefined,
			});

			const withLifecycleLockFx = Effect.fn("GameEngineResourceFx.withLifecycleLockFx")(
				<Result, Error, Requirements>(effect: Effect.Effect<Result, Error, Requirements>) =>
					lifecycle.withPermits(1)(effect),
			);

			const { clearSaveFx, createResourceFx } = dependencies;

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
						finalization.resource.markCriticalFailureFn(
							finalization.operation === "release" ? "game-leave" : "game-reset",
							Option.isSome(failure) ? failure.value : exit.cause,
						),
					);
				}),
			);

			const runFinalizationFx = Effect.fn("GameEngineFinalizationFx.runFinalizationFx")(
				(finalization: Finalization, actionFx: Effect.Effect<void, unknown, never>) =>
					actionFx.pipe(
						Effect.exit,
						Effect.flatMap((exit) => canonicalFinalizationExitFx(finalization, exit)),
						Effect.flatMap((exit) => completeFinalizationFx(finalization, exit)),
					),
			);

			const finalizeFx = Effect.fn("GameEngineFinalizationFx.finalizeFx")(
				(
					resource: InstalledGameEngineResource,
					operation: Finalization["operation"],
					actionFx: Effect.Effect<void, unknown, never>,
					allowAlreadyFinalized: boolean,
					joinInFlightOperation = false,
				): Effect.Effect<void, unknown, never> =>
					Effect.suspend(() =>
						Effect.uninterruptibleMask((restoreFx) =>
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
										restoreFx(runFinalizationFx(finalization, actionFx)),
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
						// Acquisition can fail while discarding a partial Game before a resource
						// is published. Cancellation must retain that ownership failure.
						if (
							Exit.isFailure(fiberExit) &&
							(Cause.hasDies(fiberExit.cause) ||
								fiberExit.cause.reasons.some(
									(reason) =>
										Cause.isFailReason(reason) &&
										reason.error instanceof CriticalGameLifecycleError,
								))
						) {
							const failure = readExactCauseFailureFn(fiberExit.cause);
							return yield* Effect.fail(
								Option.isSome(failure) &&
									failure.value instanceof CriticalGameLifecycleError
									? failure.value
									: new CriticalGameLifecycleError({
											operation: "engine-ownership",
											cause: fiberExit.cause,
										}),
							);
						}
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
								resource.markCriticalFailureFn(
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
					Effect.uninterruptibleMask((restoreFx) =>
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
									restoreFx(runCancellationFx(cancellation)),
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
				(owner: AcquisitionOwner, releaseFn: () => void) =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							releaseFn();
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

			let nextOwnerId = 0;

			const settleAcquisitionFx = Effect.fn("GameEngineAcquisitionFx.settleAcquisitionFx")(
				(owner: AcquisitionOwner, exit: Exit.Exit<InstalledGameEngineResource, unknown>) =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							yield* Deferred.done(owner.result, exit);
							const state = yield* Ref.get(stateRef);
							const exactOwner =
								(state._tag === "Acquiring" || state._tag === "Provisional") &&
								state.owner === owner;
							if (!exactOwner) return;
							if (Exit.isSuccess(exit)) {
								const resource = exit.value;
								owner.resource = resource;
								yield* Ref.set(stateRef, {
									_tag: "Provisional",
									owner,
									resource,
								});
								return;
							}
							if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)) {
								yield* Ref.set(stateRef, {
									_tag: "Idle",
									lastFinalized: undefined,
								});
								return;
							}
							if (Exit.isSuccess(exit)) return;
							const failure = readExactCauseFailureFn(exit.cause);
							yield* Ref.set(
								stateRef,
								Option.isSome(failure) &&
									failure.value instanceof CriticalGameLifecycleError
									? {
											_tag: "OwnershipFailed",
											error: failure.value,
											finalization: undefined,
										}
									: {
											_tag: "BootstrapFailed",
											packageId: owner.packageId,
											cause: exit.cause,
										},
							);
						}),
					),
			);

			const validateResourceFx = Effect.fn("GameEngineAcquisitionFx.validateResourceFx")(
				(owner: AcquisitionOwner, resource: InstalledGameEngineResource) =>
					Effect.gen(function* () {
						if (resource.game.arkpack.packageId === owner.packageId) {
							return resource;
						}
						const identityFailure = new CriticalGameLifecycleError({
							operation: "engine-ownership",
							cause: new Error(
								`Game Engine creation returned package ${resource.game.arkpack.packageId} for requested package ${owner.packageId}.`,
							),
						});
						const disposeExit = yield* Effect.exit(
							Effect.suspend(() => resource.game.disposeWithoutSaveFx),
						);
						const disposeFailure = Exit.isFailure(disposeExit)
							? readExactCauseFailureFn(disposeExit.cause)
							: Option.none();
						return yield* Exit.isSuccess(disposeExit)
							? Effect.fail(identityFailure)
							: Effect.fail(
									resource.markCriticalFailureFn(
										"engine-ownership",
										Option.isSome(disposeFailure)
											? disposeFailure.value
											: disposeExit.cause,
									),
								);
					}),
			);

			const runAcquisitionFx = Effect.fn("GameEngineAcquisitionFx.runAcquisitionFx")(
				(owner: AcquisitionOwner) =>
					createResourceFx(owner.packageId).pipe(
						Effect.flatMap((resource) => validateResourceFx(owner, resource)),
						Effect.onExit((exit) => settleAcquisitionFx(owner, exit)),
					),
			);

			const makeLeaseFx = Effect.fn("GameEngineAcquisitionFx.makeLeaseFx")(
				(resource: InstalledGameEngineResource, record: LeaseRecord) =>
					Effect.succeed({
						resource,
						[LeaseRecordTypeId]: record,
					} as InternalGameEngineLease),
			);

			const acquireLeaseFx: GameEngineResourceFxService["acquireLeaseFx"] = Effect.fn(
				"GameEngineResourceFx.acquireLeaseFx",
			)(({ packageId }) =>
				Effect.suspend(() =>
					Effect.uninterruptibleMask((restoreFx) =>
						withLifecycleLockFx(
							Effect.gen(function* () {
								const state = yield* Ref.get(stateRef);
								if (state._tag === "OwnershipFailed") {
									return {
										_tag: "Failure" as const,
										cause: state.error,
									};
								}
								if (state._tag === "Active") {
									return state.resource.game.arkpack.packageId === packageId
										? {
												_tag: "Resource" as const,
												resource: state.resource,
												record: {
													owner: undefined,
													token: Symbol(),
												} satisfies LeaseRecord,
											}
										: {
												_tag: "ReplaceActive" as const,
												resource: state.resource,
											};
								}
								if (state._tag === "Finalizing") {
									return {
										_tag: "WaitFinalization" as const,
										completion: state.finalization.completion,
									};
								}
								if (state._tag === "Cancelling") {
									return {
										_tag: "WaitCancellation" as const,
										completion: state.cancellation.completion,
									};
								}
								if (state._tag === "RecoveringFailedSave") {
									return {
										_tag: "WaitRecovery" as const,
										completion: state.recovery.completion,
									};
								}
								if (
									(state._tag === "Acquiring" || state._tag === "Provisional") &&
									state.owner.packageId !== packageId
								) {
									return {
										_tag: "Replace" as const,
										owner: state.owner,
									};
								}
								if (state._tag === "BootstrapFailed") {
									return {
										_tag: "CauseFailure" as const,
										cause: state.cause,
									};
								}
								let owner: AcquisitionOwner;
								if (state._tag === "Acquiring" || state._tag === "Provisional") {
									owner = state.owner;
								} else {
									const result = yield* Deferred.make<
										InstalledGameEngineResource,
										unknown
									>();
									owner = {
										id: ++nextOwnerId,
										packageId,
										closeClaims: new Set(),
										consumers: new Set(),
										result,
										fiber: undefined,
										resource: undefined,
									};
									yield* Ref.set(stateRef, {
										_tag: "Acquiring",
										owner,
									});
									owner.fiber = yield* Effect.forkIn(
										restoreFx(runAcquisitionFx(owner)),
										operationScope,
									);
								}
								const token = Symbol();
								owner.consumers.add(token);
								return {
									_tag: "Owner" as const,
									owner,
									token,
								};
							}),
						),
					),
				).pipe(
					Effect.flatMap((decision) => {
						switch (decision._tag) {
							case "Failure":
								return Effect.fail(decision.cause);
							case "CauseFailure":
								return Effect.failCause(decision.cause);
							case "Resource":
								return makeLeaseFx(decision.resource, decision.record);
							case "WaitFinalization":
								return Effect.exit(Deferred.await(decision.completion)).pipe(
									Effect.andThen(
										acquireLeaseFx({
											packageId,
										}),
									),
								);
							case "WaitCancellation":
								return Effect.exit(Deferred.await(decision.completion)).pipe(
									Effect.andThen(
										acquireLeaseFx({
											packageId,
										}),
									),
								);
							case "WaitRecovery":
								return Effect.exit(Deferred.await(decision.completion)).pipe(
									Effect.andThen(
										acquireLeaseFx({
											packageId,
										}),
									),
								);
							case "Replace":
								return beginCancellationFx(decision.owner, true).pipe(
									Effect.andThen(
										acquireLeaseFx({
											packageId,
										}),
									),
								);
							case "ReplaceActive":
								return finalizeFx(
									decision.resource,
									"release",
									Effect.suspend(() => decision.resource.game.disposeFx),
									false,
								).pipe(
									Effect.andThen(
										acquireLeaseFx({
											packageId,
										}),
									),
								);
							case "Owner": {
								const record = {
									owner: decision.owner,
									token: decision.token,
								} satisfies LeaseRecord;
								return Effect.addFinalizer(() => releaseLeaseRecordFx(record)).pipe(
									Effect.andThen(Deferred.await(decision.owner.result)),
									Effect.flatMap((resource) => makeLeaseFx(resource, record)),
									Effect.onInterrupt(() => releaseLeaseRecordFx(record)),
								);
							}
						}
					}),
				),
			);

			const adoptLeaseFx: GameEngineResourceFxService["adoptLeaseFx"] = Effect.fn(
				"GameEngineResourceFx.adoptLeaseFx",
			)((lease) =>
				withLifecycleLockFx(
					Effect.gen(function* () {
						const record = (lease as Partial<InternalGameEngineLease>)[
							LeaseRecordTypeId
						];
						if (record === undefined) {
							return yield* Effect.fail(new Error("Unknown Game Engine lease."));
						}
						const state = yield* Ref.get(stateRef);
						if (state._tag === "OwnershipFailed") {
							return yield* Effect.fail(state.error);
						}
						if (state._tag === "Active" && state.resource === lease.resource) {
							return state.resource;
						}
						if (
							record.owner !== undefined &&
							state._tag === "Provisional" &&
							state.owner === record.owner &&
							state.resource === lease.resource &&
							record.owner.consumers.has(record.token)
						) {
							yield* Ref.set(stateRef, {
								_tag: "Active",
								resource: state.resource,
							});
							return state.resource;
						}
						return yield* Effect.fail(
							new Error("Game Engine lease cannot adopt a stale resource."),
						);
					}),
				),
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
					Effect.uninterruptibleMask((restoreFx) =>
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
									restoreFx(runFailedSaveRecoveryFx(recovery)),
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

			/**
			 * Native close must claim provisional ownership before navigation aborts
			 * the loader that currently holds the last acquisition lease.
			 */
			const claimForCloseFx: GameEngineResourceFxService["claimForCloseFx"] = Effect.fn(
				"GameEngineResourceFx.claimForCloseFx",
			)(() =>
				Effect.suspend(() =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							const state = yield* Ref.get(stateRef);
							switch (state._tag) {
								case "Idle":
								case "BootstrapFailed":
								case "RecoveringFailedSave":
									return {
										_tag: "None",
									} satisfies ClaimDecision;
								case "OwnershipFailed":
									return state.finalization === undefined
										? yield* Effect.fail(state.error)
										: ({
												_tag: "Resource",
												resource: state.finalization.resource,
											} satisfies ClaimDecision);
								case "Active":
									return {
										_tag: "Resource",
										resource: state.resource,
									} satisfies ClaimDecision;
								case "Finalizing":
									return {
										_tag: "Resource",
										resource: state.finalization.resource,
									} satisfies ClaimDecision;
								case "Cancelling":
									return {
										_tag: "WaitCancellation",
										completion: state.cancellation.completion,
									} satisfies ClaimDecision;
								case "Acquiring":
								case "Provisional": {
									const token = Symbol();
									state.owner.closeClaims.add(token);
									return {
										_tag: "Owner",
										owner: state.owner,
										token,
									} satisfies ClaimDecision;
								}
							}
						}),
					).pipe(
						Effect.flatMap((decision) => {
							switch (decision._tag) {
								case "None":
									return Effect.succeed(null);
								case "Resource":
									return Effect.succeed(decision.resource);
								case "WaitCancellation":
									return Effect.exit(Deferred.await(decision.completion)).pipe(
										Effect.andThen(claimForCloseFx),
									);
								case "Owner":
									return Deferred.await(decision.owner.result).pipe(
										Effect.flatMap((resource) =>
											withLifecycleLockFx(
												Effect.gen(function* () {
													const state = yield* Ref.get(stateRef);
													if (
														state._tag === "Provisional" &&
														state.owner === decision.owner &&
														state.resource === resource
													) {
														yield* Ref.set(stateRef, {
															_tag: "Active",
															resource,
														});
														return resource;
													}
													if (
														state._tag === "Active" &&
														state.resource === resource
													) {
														return resource;
													}
													if (state._tag === "OwnershipFailed") {
														return yield* Effect.fail(state.error);
													}
													return null;
												}),
											),
										),
										Effect.onInterrupt(() =>
											releaseCloseClaimFx(decision.owner, decision.token),
										),
										Effect.catchCause((cause) => {
											const failure = readExactCauseFailureFn(cause);
											return Option.isSome(failure) &&
												failure.value instanceof CriticalGameLifecycleError
												? Effect.fail(failure.value)
												: Effect.succeed(null);
										}),
									);
							}
						}),
					),
				),
			)();

			const shutdownFx = Effect.fn("GameEngineResourceFx.shutdownFx")(() =>
				Effect.suspend(() =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							const state = yield* Ref.get(stateRef);
							switch (state._tag) {
								case "Acquiring":
								case "Provisional":
									return {
										_tag: "Cancel" as const,
										owner: state.owner,
									};
								case "Cancelling":
									return {
										_tag: "WaitCancellation" as const,
										completion: state.cancellation.completion,
									};
								case "Active":
									return {
										_tag: "Release" as const,
										resource: state.resource,
									};
								case "Finalizing":
									return {
										_tag: "WaitFinalization" as const,
										completion: state.finalization.completion,
									};
								case "RecoveringFailedSave":
									return {
										_tag: "WaitRecovery" as const,
										completion: state.recovery.completion,
									};
								case "Idle":
								case "BootstrapFailed":
								case "OwnershipFailed":
									return {
										_tag: "Done" as const,
									};
							}
						}),
					).pipe(
						Effect.flatMap((decision) => {
							switch (decision._tag) {
								case "Cancel":
									return beginCancellationFx(decision.owner, true);
								case "WaitCancellation":
									return Deferred.await(decision.completion);
								case "WaitFinalization":
									return Deferred.await(decision.completion);
								case "WaitRecovery":
									return Deferred.await(decision.completion);
								case "Release":
									return finalizeFx(
										decision.resource,
										"release",
										Effect.suspend(() => decision.resource.game.disposeFx),
										true,
									);
								case "Done":
									return Effect.void;
							}
						}),
						Effect.catchCause(() => Effect.void),
					),
				),
			);

			const readCurrentFx = Effect.fn("GameEngineResourceFx.currentFx")(() =>
				Effect.suspend(() =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							const state = yield* Ref.get(stateRef);
							if (state._tag === "OwnershipFailed") {
								return yield* Effect.fail(state.error);
							}
							if (state._tag === "Active") return state.resource;
							if (state._tag === "Finalizing") {
								return state.finalization.resource;
							}
							return null;
						}),
					),
				),
			);

			const prepareEditorHandoffFx: GameEngineResourceFxService["prepareEditorHandoffFx"] =
				Effect.fn("GameEngineResourceFx.prepareEditorHandoffFx")(() =>
					Effect.suspend(() => {
						const retryAfterFx = (operationFx: Effect.Effect<void, unknown, never>) =>
							Effect.exit(operationFx).pipe(Effect.andThen(prepareEditorHandoffFx));
						return withLifecycleLockFx(
							Ref.get(stateRef).pipe(
								Effect.map(
									(
										state,
									): GameEngineResourceFxService["prepareEditorHandoffFx"] => {
										switch (state._tag) {
											case "Idle":
											case "BootstrapFailed":
												return Effect.succeed(null);
											case "OwnershipFailed":
												return Effect.fail(state.error);
											case "Active":
												return Effect.succeed(state.resource);
											case "Acquiring":
											case "Provisional":
												return beginCancellationFx(state.owner, true).pipe(
													Effect.andThen(prepareEditorHandoffFx),
												);
											case "Cancelling":
												return retryAfterFx(
													Deferred.await(state.cancellation.completion),
												);
											case "Finalizing":
												return retryAfterFx(
													Deferred.await(state.finalization.completion),
												);
											case "RecoveringFailedSave":
												return retryAfterFx(
													Deferred.await(state.recovery.completion),
												);
										}
									},
								),
							),
						).pipe(Effect.flatten);
					}),
				)();

			const closeFx: GameEngineResourceFxService["closeFx"] = Effect.fn(
				"GameEngineResourceFx.closeFx",
			)((resource) =>
				Effect.exit(
					finalizeFx(
						resource,
						"release",
						Effect.suspend(() => resource.game.disposeFx),
						true,
						true,
					),
				).pipe(
					Effect.flatMap(
						(exit): Effect.Effect<GameEngineResourceFx.CloseResult, never, never> => {
							if (Exit.isSuccess(exit)) {
								return Effect.succeed({
									type: "saved",
								});
							}
							const failure = readExactCauseFailureFn(exit.cause);
							return Effect.succeed({
								type: "finalization-failed" as const,
								cause: Option.isSome(failure) ? failure.value : exit.cause,
							});
						},
					),
				),
			);

			const service = {
				currentFx: readCurrentFx(),
				prepareEditorHandoffFx,
				acquireLeaseFx,
				adoptLeaseFx,
				claimForCloseFx,
				releaseFx,
				resetFx,
				closeFx,
				discardFailedFx,
				recoverFailedSaveFx,
			} satisfies GameEngineResourceFxService;

			yield* Effect.addFinalizer(() =>
				shutdownFx().pipe(Effect.ensuring(Scope.close(operationScope, Exit.void))),
			);
			return service;
		}),
);
