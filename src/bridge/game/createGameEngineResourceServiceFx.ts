import { Cause, Deferred, Effect, Exit, Fiber, Layer, Option, Scope, Semaphore } from "effect";

import {
	CriticalGameLifecycleError,
	toCriticalGameLifecycleError,
} from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import {
	GameEngineResourceFx,
	type GameEngineLease,
	type GameEngineResourceFxService,
} from "~/bridge/game/GameEngineResourceFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

export namespace createGameEngineResourceServiceFx {
	export interface Dependencies {
		readonly clearSaveFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown>;
		/**
		 * Creates the resource only. This service is the sole lifecycle lock owner;
		 * cutover must remove the legacy per-resource lifecycle lock instead of
		 * composing both locks.
		 */
		readonly createResourceFx: (
			packageId: string,
		) => Effect.Effect<GameEngineResource, unknown>;
	}
}

interface AcquisitionOwner {
	readonly id: number;
	readonly packageId: string;
	readonly closeClaims: Set<symbol>;
	readonly consumers: Set<symbol>;
	readonly result: Deferred.Deferred<GameEngineResource, unknown>;
	fiber: Fiber.Fiber<GameEngineResource, unknown> | undefined;
	resource: GameEngineResource | undefined;
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
	readonly resource: GameEngineResource;
	readonly operation: "release" | "reset";
	readonly completion: Deferred.Deferred<void, unknown>;
}

interface FailedSaveRecovery {
	readonly packageId: string;
	readonly bootstrapCause: Cause.Cause<unknown>;
	readonly error: GameSaveBootstrapError;
	readonly completion: Deferred.Deferred<void, unknown>;
}

type ClaimDecision =
	| {
			readonly _tag: "None";
	  }
	| {
			readonly _tag: "Resource";
			readonly resource: GameEngineResource;
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

type State =
	| {
			readonly _tag: "Idle";
			readonly lastFinalized: GameEngineResource | undefined;
	  }
	| {
			readonly _tag: "Acquiring";
			readonly owner: AcquisitionOwner;
	  }
	| {
			readonly _tag: "Provisional";
			readonly owner: AcquisitionOwner;
			readonly resource: GameEngineResource;
	  }
	| {
			readonly _tag: "Cancelling";
			readonly cancellation: Cancellation;
	  }
	| {
			readonly _tag: "Active";
			readonly resource: GameEngineResource;
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
	  };

const idleState = (lastFinalized?: GameEngineResource): State => ({
	_tag: "Idle",
	lastFinalized,
});

const exactOwner = (state: State, owner: AcquisitionOwner) =>
	(state._tag === "Acquiring" || state._tag === "Provisional") && state.owner === owner;

/** Creates one scoped Game resource state machine without publishing it globally. */
export const createGameEngineResourceServiceFx = Effect.fn("createGameEngineResourceServiceFx")(
	(dependencies: createGameEngineResourceServiceFx.Dependencies) =>
		Effect.gen(function* () {
			const lifecycle = yield* Semaphore.make(1);
			const operationScope = yield* Scope.make();
			let state: State = idleState();
			let nextOwnerId = 0;

			const withLifecycleLockFx = Effect.fn("GameEngineResourceFx.withLifecycleLockFx")(
				<Result, Error, Requirements>(effect: Effect.Effect<Result, Error, Requirements>) =>
					lifecycle.withPermits(1)(effect),
			);

			const settleAcquisitionFx = Effect.fn("GameEngineResourceFx.settleAcquisitionFx")(
				(owner: AcquisitionOwner, exit: Exit.Exit<GameEngineResource, unknown>) =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							yield* Deferred.done(owner.result, exit);
							if (!exactOwner(state, owner)) return;
							if (Exit.isSuccess(exit)) {
								const resource = exit.value;
								owner.resource = resource;
								state = {
									_tag: "Provisional",
									owner,
									resource,
								};
								return;
							}
							if (Cause.hasInterruptsOnly(exit.cause)) {
								state = idleState();
								return;
							}
							const failure = readExactCauseFailure(exit.cause);
							state =
								Option.isSome(failure) &&
								failure.value instanceof CriticalGameLifecycleError
									? {
											_tag: "OwnershipFailed",
											error: failure.value,
										}
									: {
											_tag: "BootstrapFailed",
											packageId: owner.packageId,
											cause: exit.cause,
										};
						}),
					),
			);

			const validateResourceFx = Effect.fn("GameEngineResourceFx.validateResourceFx")(
				(owner: AcquisitionOwner, resource: GameEngineResource) =>
					Effect.gen(function* () {
						if (resource.game.arkpack.packageId === owner.packageId) {
							return resource;
						}
						const identityFailure = toCriticalGameLifecycleError({
							operation: "engine-ownership",
							cause: new Error(
								`Game Engine creation returned package ${resource.game.arkpack.packageId} for requested package ${owner.packageId}.`,
							),
						});
						const disposeExit = yield* Effect.exit(
							Effect.suspend(() => resource.game.disposeWithoutSaveFx),
						);
						const disposeFailure = Exit.isFailure(disposeExit)
							? readExactCauseFailure(disposeExit.cause)
							: Option.none();
						return yield* Exit.isSuccess(disposeExit)
							? Effect.fail(identityFailure)
							: Effect.fail(
									resource.markCriticalFailure(
										"engine-ownership",
										Option.isSome(disposeFailure)
											? disposeFailure.value
											: disposeExit.cause,
									),
								);
					}),
			);

			const runAcquisitionFx = Effect.fn("GameEngineResourceFx.runAcquisitionFx")(
				(owner: AcquisitionOwner) =>
					dependencies.createResourceFx(owner.packageId).pipe(
						Effect.flatMap((resource) => validateResourceFx(owner, resource)),
						Effect.onExit((exit) => settleAcquisitionFx(owner, exit)),
					),
			);

			const completeCancellationFx = Effect.fn("GameEngineResourceFx.completeCancellationFx")(
				(cancellation: Cancellation, exit: Exit.Exit<void, CriticalGameLifecycleError>) =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							if (
								state._tag === "Cancelling" &&
								state.cancellation === cancellation
							) {
								const failure = Exit.isFailure(exit)
									? readExactCauseFailure(exit.cause)
									: Option.none();
								state = Exit.isSuccess(exit)
									? idleState()
									: {
											_tag: "OwnershipFailed",
											error:
												Option.isSome(failure) &&
												failure.value instanceof CriticalGameLifecycleError
													? failure.value
													: toCriticalGameLifecycleError({
															operation: "engine-ownership",
															cause: Option.isSome(failure)
																? failure.value
																: exit.cause,
														}),
										};
							}
							yield* Deferred.done(cancellation.completion, exit);
						}),
					),
			);

			const runCancellationFx = Effect.fn("GameEngineResourceFx.runCancellationFx")(
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
							const failure = readExactCauseFailure(disposeExit.cause);
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

			const beginCancellationFx = Effect.fn("GameEngineResourceFx.beginCancellationFx")(
				(owner: AcquisitionOwner, force: boolean) =>
					Effect.uninterruptibleMask((restore) =>
						withLifecycleLockFx(
							Effect.gen(function* () {
								if (
									state._tag === "Cancelling" &&
									state.cancellation.owner === owner
								) {
									return state.cancellation.completion;
								}
								if (!exactOwner(state, owner)) return null;
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
								state = {
									_tag: "Cancelling",
									cancellation,
								};
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

			const releaseLeaseRecordFx = Effect.fn("GameEngineResourceFx.releaseLeaseRecordFx")(
				(record: LeaseRecord) => {
					if (record.owner === undefined) return Effect.void;
					const owner = record.owner;
					return withLifecycleLockFx(
						Effect.sync(() => {
							owner.consumers.delete(record.token);
							return (
								exactOwner(state, owner) &&
								owner.closeClaims.size === 0 &&
								owner.consumers.size === 0
							);
						}),
					).pipe(
						Effect.flatMap((cancel) =>
							cancel ? beginCancellationFx(owner, false) : Effect.void,
						),
						Effect.catch(() => Effect.void),
					);
				},
			);

			const releaseCloseClaimFx = Effect.fn("GameEngineResourceFx.releaseCloseClaimFx")(
				(owner: AcquisitionOwner, token: symbol) =>
					withLifecycleLockFx(
						Effect.sync(() => {
							owner.closeClaims.delete(token);
							return (
								exactOwner(state, owner) &&
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

			const makeLease = (
				resource: GameEngineResource,
				record: LeaseRecord,
			): GameEngineLease =>
				({
					resource,
					[LeaseRecordTypeId]: record,
				}) as InternalGameEngineLease;

			const acquireLeaseFx: GameEngineResourceFxService["acquireLeaseFx"] = Effect.fn(
				"GameEngineResourceFx.acquireLeaseFx",
			)(({ packageId }) =>
				Effect.suspend(() =>
					Effect.uninterruptibleMask((restore) =>
						withLifecycleLockFx(
							Effect.gen(function* () {
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
										GameEngineResource,
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
									state = {
										_tag: "Acquiring",
										owner,
									};
									owner.fiber = yield* Effect.forkIn(
										restore(runAcquisitionFx(owner)),
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
								return Effect.succeed(
									makeLease(decision.resource, decision.record),
								);
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
									Effect.map((resource) => makeLease(resource, record)),
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
					Effect.suspend(() => {
						const record = (lease as Partial<InternalGameEngineLease>)[
							LeaseRecordTypeId
						];
						if (record === undefined) {
							return Effect.fail(new Error("Unknown Game Engine lease."));
						}
						if (state._tag === "Active" && state.resource === lease.resource) {
							return Effect.succeed(state.resource);
						}
						if (
							record.owner !== undefined &&
							state._tag === "Provisional" &&
							state.owner === record.owner &&
							state.resource === lease.resource &&
							record.owner.consumers.has(record.token)
						) {
							state = {
								_tag: "Active",
								resource: state.resource,
							};
							return Effect.succeed(state.resource);
						}
						return Effect.fail(
							new Error("Game Engine lease cannot adopt a stale resource."),
						);
					}),
				),
			);

			const claimForCloseFx: GameEngineResourceFxService["claimForCloseFx"] = Effect.fn(
				"GameEngineResourceFx.claimForCloseFx",
			)(() =>
				Effect.suspend(() =>
					withLifecycleLockFx(
						Effect.suspend<ClaimDecision, CriticalGameLifecycleError, never>(() => {
							switch (state._tag) {
								case "Idle":
								case "BootstrapFailed":
								case "RecoveringFailedSave":
									return Effect.succeed({
										_tag: "None" as const,
									});
								case "OwnershipFailed":
									return Effect.fail(state.error);
								case "Active":
									return Effect.succeed({
										_tag: "Resource" as const,
										resource: state.resource,
									});
								case "Finalizing":
									return Effect.succeed({
										_tag: "Resource" as const,
										resource: state.finalization.resource,
									});
								case "Cancelling":
									return Effect.succeed({
										_tag: "WaitCancellation" as const,
										completion: state.cancellation.completion,
									});
								case "Acquiring":
								case "Provisional": {
									const token = Symbol();
									state.owner.closeClaims.add(token);
									return Effect.succeed({
										_tag: "Owner" as const,
										owner: state.owner,
										token,
									});
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
												Effect.suspend(() => {
													if (
														state._tag === "Provisional" &&
														state.owner === decision.owner &&
														state.resource === resource
													) {
														state = {
															_tag: "Active",
															resource,
														};
														return Effect.succeed(resource);
													}
													if (
														state._tag === "Active" &&
														state.resource === resource
													) {
														return Effect.succeed(resource);
													}
													if (state._tag === "OwnershipFailed") {
														return Effect.fail(state.error);
													}
													return Effect.succeed(null);
												}),
											),
										),
										Effect.onInterrupt(() =>
											releaseCloseClaimFx(decision.owner, decision.token),
										),
										Effect.catchCause((cause) => {
											const failure = readExactCauseFailure(cause);
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

			const completeFinalizationFx = Effect.fn("GameEngineResourceFx.completeFinalizationFx")(
				(finalization: Finalization, exit: Exit.Exit<void, unknown>) =>
					withLifecycleLockFx(
						Effect.gen(function* () {
							if (
								state._tag === "Finalizing" &&
								state.finalization === finalization
							) {
								state = Exit.isSuccess(exit)
									? idleState(finalization.resource)
									: {
											_tag: "Active",
											resource: finalization.resource,
										};
							}
							yield* Deferred.done(finalization.completion, exit);
						}),
					),
			);

			const canonicalFinalizationExit = (
				finalization: Finalization,
				exit: Exit.Exit<void, unknown>,
			): Exit.Exit<void, CriticalGameLifecycleError> => {
				if (Exit.isSuccess(exit)) return Exit.void;
				const failure = readExactCauseFailure(exit.cause);
				return Exit.fail(
					finalization.resource.markCriticalFailure(
						finalization.operation === "release" ? "game-leave" : "game-reset",
						Option.isSome(failure) ? failure.value : exit.cause,
					),
				);
			};

			const runFinalizationFx = Effect.fn("GameEngineResourceFx.runFinalizationFx")(
				(finalization: Finalization, actionFx: Effect.Effect<void, unknown>) =>
					actionFx.pipe(
						Effect.exit,
						Effect.flatMap((exit) =>
							completeFinalizationFx(
								finalization,
								canonicalFinalizationExit(finalization, exit),
							),
						),
					),
			);

			const finalizeFx = Effect.fn("GameEngineResourceFx.finalizeFx")(
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
									const completion = yield* Deferred.make<void, unknown>();
									const finalization = {
										resource,
										operation,
										completion,
									} satisfies Finalization;
									state = {
										_tag: "Finalizing",
										finalization,
									};
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
									return Deferred.await(decision.completion);
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
						Effect.andThen(
							Effect.suspend(() => dependencies.clearSaveFx(resource.game.saveKey)),
						),
					),
					false,
				),
			);

			const discardFailedFx: GameEngineResourceFxService["discardFailedFx"] = Effect.fn(
				"GameEngineResourceFx.discardFailedFx",
			)((packageId) =>
				withLifecycleLockFx(
					Effect.suspend(() => {
						if (state._tag !== "BootstrapFailed" || state.packageId !== packageId) {
							return Effect.fail(
								new Error(
									"Failed Game exit requires one exact failed bootstrap resource.",
								),
							);
						}
						const exactFailure = readExactCauseFailure(state.cause);
						const failure: Option.Option<GameSaveBootstrapError> =
							Option.isSome(exactFailure) &&
							exactFailure.value instanceof GameSaveBootstrapError
								? Option.some(exactFailure.value)
								: Option.none();
						if (Option.isSome(failure)) {
							return Effect.fail(
								new Error(
									"Verified save failures require exact save cleanup before exit.",
								),
							);
						}
						state = idleState();
						return Effect.void;
					}),
				),
			);

			const completeFailedSaveRecoveryFx = Effect.fn(
				"GameEngineResourceFx.completeFailedSaveRecoveryFx",
			)((recovery: FailedSaveRecovery, exit: Exit.Exit<void, unknown>) =>
				withLifecycleLockFx(
					Effect.gen(function* () {
						if (state._tag === "RecoveringFailedSave" && state.recovery === recovery) {
							state = Exit.isSuccess(exit)
								? idleState()
								: {
										_tag: "BootstrapFailed",
										packageId: recovery.packageId,
										cause: recovery.bootstrapCause,
									};
						}
						yield* Deferred.done(recovery.completion, exit);
					}),
				),
			);

			const runFailedSaveRecoveryFx = Effect.fn(
				"GameEngineResourceFx.runFailedSaveRecoveryFx",
			)((recovery: FailedSaveRecovery) =>
				dependencies.clearSaveFx(recovery.error.saveKey).pipe(
					Effect.exit,
					Effect.flatMap((exit) => completeFailedSaveRecoveryFx(recovery, exit)),
				),
			);

			const recoverFailedSaveFx: GameEngineResourceFxService["recoverFailedSaveFx"] =
				Effect.fn("GameEngineResourceFx.recoverFailedSaveFx")(({ packageId }) =>
					Effect.uninterruptibleMask((restore) =>
						withLifecycleLockFx(
							Effect.gen(function* () {
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
								const exactFailure = readExactCauseFailure(state.cause);
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
								state = {
									_tag: "RecoveringFailedSave",
									recovery,
								};
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

			const shutdownFx = Effect.fn("GameEngineResourceFx.shutdownFx")(() =>
				Effect.suspend(() =>
					withLifecycleLockFx(
						Effect.sync(() => {
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
						Effect.suspend(() => {
							if (state._tag === "OwnershipFailed") return Effect.fail(state.error);
							if (state._tag === "Active") return Effect.succeed(state.resource);
							if (state._tag === "Finalizing") {
								return Effect.succeed(state.finalization.resource);
							}
							return Effect.succeed(null);
						}),
					),
				),
			);

			const service = {
				currentFx: readCurrentFx(),
				acquireLeaseFx,
				adoptLeaseFx,
				claimForCloseFx,
				releaseFx,
				resetFx,
				closeFx: Effect.fn("GameEngineResourceFx.closeFx")((resource) =>
					Effect.exit(
						finalizeFx(
							resource,
							"release",
							Effect.suspend(() => resource.game.disposeFx),
							true,
							true,
						),
					).pipe(
						Effect.map((exit): GameEngineResourceFx.CloseResult => {
							if (Exit.isSuccess(exit)) {
								return {
									type: "saved",
								};
							}
							const failure = readExactCauseFailure(exit.cause);
							return {
								type: "finalization-failed",
								cause: Option.isSome(failure) ? failure.value : exit.cause,
							};
						}),
					),
				),
				discardFailedFx,
				recoverFailedSaveFx,
			} satisfies GameEngineResourceFxService;

			yield* Effect.addFinalizer(() =>
				shutdownFx().pipe(Effect.ensuring(Scope.close(operationScope, Exit.void))),
			);
			return service;
		}),
);

/** Builds one independent scoped Game resource authority. */
export const GameEngineResourceLayer = (
	dependencies: createGameEngineResourceServiceFx.Dependencies,
) => Layer.effect(GameEngineResourceFx, createGameEngineResourceServiceFx(dependencies));
