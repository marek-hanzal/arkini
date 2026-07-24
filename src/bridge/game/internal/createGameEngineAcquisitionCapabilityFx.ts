import { Cause, Deferred, Effect, Exit, Option, Ref, Scope, type Semaphore } from "effect";

import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import type { GameEngineResourceFxService } from "~/bridge/game/GameEngineResourceFx";
import { readExactCauseFailure } from "~/bridge/game/readExactCauseFailure";
import type {
	AcquisitionOwner,
	Finalization,
	GameEngineResourceServiceState,
	InternalGameEngineLease,
	LeaseRecord,
} from "~/bridge/game/internal/GameEngineResourceServiceState";
import { LeaseRecordTypeId } from "~/bridge/game/internal/GameEngineResourceServiceState";

export namespace createGameEngineAcquisitionCapabilityFx {
	export interface Dependencies {
		readonly beginCancellationFx: (
			owner: AcquisitionOwner,
			force: boolean,
		) => Effect.Effect<void, CriticalGameLifecycleError>;
		readonly createResourceFx: (
			packageId: string,
		) => Effect.Effect<GameEngineResource, unknown>;
		readonly finalizeFx: (
			resource: GameEngineResource,
			operation: Finalization["operation"],
			actionFx: Effect.Effect<void, unknown>,
			allowAlreadyFinalized: boolean,
			joinInFlightOperation?: boolean,
		) => Effect.Effect<void, unknown>;
		readonly lifecycle: Semaphore.Semaphore;
		readonly operationScope: Scope.Scope;
		readonly releaseLeaseRecordFx: (record: LeaseRecord) => Effect.Effect<void>;
		readonly stateRef: Ref.Ref<GameEngineResourceServiceState>;
	}

	export interface Capability {
		readonly acquireLeaseFx: GameEngineResourceFxService["acquireLeaseFx"];
		readonly adoptLeaseFx: GameEngineResourceFxService["adoptLeaseFx"];
	}
}

/** Owns exact-package acquisition, lease publication, and replacement sequencing. */
export const createGameEngineAcquisitionCapabilityFx = Effect.fn(
	"createGameEngineAcquisitionCapabilityFx",
)(
	({
		beginCancellationFx,
		createResourceFx,
		finalizeFx,
		lifecycle,
		operationScope,
		releaseLeaseRecordFx,
		stateRef,
	}: createGameEngineAcquisitionCapabilityFx.Dependencies) =>
		Effect.gen(function* () {
			let nextOwnerId = 0;

			const withLifecycleLockFx = Effect.fn("GameEngineAcquisitionFx.withLifecycleLockFx")(
				<Result, Error, Requirements>(effect: Effect.Effect<Result, Error, Requirements>) =>
					lifecycle.withPermits(1)(effect),
			);

			const settleAcquisitionFx = Effect.fn("GameEngineAcquisitionFx.settleAcquisitionFx")(
				(owner: AcquisitionOwner, exit: Exit.Exit<GameEngineResource, unknown>) =>
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
							const failure = readExactCauseFailure(exit.cause);
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
				(owner: AcquisitionOwner, resource: GameEngineResource) =>
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

			const runAcquisitionFx = Effect.fn("GameEngineAcquisitionFx.runAcquisitionFx")(
				(owner: AcquisitionOwner) =>
					createResourceFx(owner.packageId).pipe(
						Effect.flatMap((resource) => validateResourceFx(owner, resource)),
						Effect.onExit((exit) => settleAcquisitionFx(owner, exit)),
					),
			);

			const makeLeaseFx = Effect.fn("GameEngineAcquisitionFx.makeLeaseFx")(
				(resource: GameEngineResource, record: LeaseRecord) =>
					Effect.succeed({
						resource,
						[LeaseRecordTypeId]: record,
					} as InternalGameEngineLease),
			);

			const acquireLeaseFx: GameEngineResourceFxService["acquireLeaseFx"] = Effect.fn(
				"GameEngineResourceFx.acquireLeaseFx",
			)(({ packageId }) =>
				Effect.suspend(() =>
					Effect.uninterruptibleMask((restore) =>
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
									yield* Ref.set(stateRef, {
										_tag: "Acquiring",
										owner,
									});
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

			return {
				acquireLeaseFx,
				adoptLeaseFx,
			} satisfies createGameEngineAcquisitionCapabilityFx.Capability;
		}),
);
