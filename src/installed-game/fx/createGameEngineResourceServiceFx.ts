import { Deferred, Effect, Exit, Option, Ref, Scope, Semaphore } from "effect";

import { CriticalGameLifecycleError } from "~/playable-game/error/CriticalGameLifecycleError";
import type { InstalledGameEngineResource } from "~/installed-game/type/Game";
import {
	GameEngineResourceFx,
	type GameEngineResourceFxService,
} from "~/installed-game/service/GameEngineResourceFx";
import { createGameEngineAcquisitionCapabilityFx } from "~/installed-game/fx/createGameEngineAcquisitionCapabilityFx";
import { createGameEngineCancellationCapabilityFx } from "~/installed-game/fx/createGameEngineCancellationCapabilityFx";
import { createGameEngineFinalizationCapabilityFx } from "~/installed-game/fx/createGameEngineFinalizationCapabilityFx";
import { createFailedSaveRecoveryCapabilityFx } from "~/installed-game/fx/createFailedSaveRecoveryCapabilityFx";
import type {
	AcquisitionOwner,
	GameEngineResourceServiceState,
} from "~/installed-game/type/GameEngineResourceServiceState";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

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
 * Capability modules split acquisition/cancellation/finalization/recovery code,
 * but all transitions still share this semaphore, state Ref and operation Scope;
 * none is an independent owner.
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

			const finalization = yield* createGameEngineFinalizationCapabilityFx({
				clearSaveFx: dependencies.clearSaveFx,
				lifecycle,
				operationScope,
				stateRef,
			});
			const cancellation = yield* createGameEngineCancellationCapabilityFx({
				lifecycle,
				operationScope,
				stateRef,
			});
			const acquisition = yield* createGameEngineAcquisitionCapabilityFx({
				beginCancellationFx: cancellation.beginCancellationFx,
				createResourceFx: dependencies.createResourceFx,
				finalizeFx: finalization.finalizeFx,
				lifecycle,
				operationScope,
				releaseLeaseRecordFx: cancellation.releaseLeaseRecordFx,
				stateRef,
			});
			const failedSaveRecovery = yield* createFailedSaveRecoveryCapabilityFx({
				clearSaveFx: dependencies.clearSaveFx,
				lifecycle,
				operationScope,
				stateRef,
			});

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
											cancellation.releaseCloseClaimFx(
												decision.owner,
												decision.token,
											),
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
									return cancellation.beginCancellationFx(decision.owner, true);
								case "WaitCancellation":
									return Deferred.await(decision.completion);
								case "WaitFinalization":
									return Deferred.await(decision.completion);
								case "WaitRecovery":
									return Deferred.await(decision.completion);
								case "Release":
									return finalization.finalizeFx(
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
												return cancellation
													.beginCancellationFx(state.owner, true)
													.pipe(Effect.andThen(prepareEditorHandoffFx));
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
					finalization.finalizeFx(
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
				acquireLeaseFx: acquisition.acquireLeaseFx,
				adoptLeaseFx: acquisition.adoptLeaseFx,
				claimForCloseFx,
				releaseFx: finalization.releaseFx,
				resetFx: finalization.resetFx,
				closeFx,
				discardFailedFx: failedSaveRecovery.discardFailedFx,
				recoverFailedSaveFx: failedSaveRecovery.recoverFailedSaveFx,
			} satisfies GameEngineResourceFxService;

			yield* Effect.addFinalizer(() =>
				shutdownFx().pipe(Effect.ensuring(Scope.close(operationScope, Exit.void))),
			);
			return service;
		}),
);
