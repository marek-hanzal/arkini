import { Cause, Effect, Option } from "effect";

import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

type FailedSaveRecovery = {
	readonly key: GameSaveStorage.Key;
	readonly saveCleared: boolean;
};

type HardResetRecovery = {
	readonly packageId: string;
	readonly saveKey: GameSaveStorage.Key;
	readonly discarded: boolean;
	readonly saveCleared: boolean;
};

const failureFromCause = (cause: Cause.Cause<unknown>) => {
	const failure = Cause.failureOption(cause);
	return Option.isSome(failure) ? failure.value : Cause.squash(cause);
};

/** Serializes the explicit lifecycle of one published game instance. */
export const createGameOwnerFx = Effect.fn("createGameOwnerFx")(
	({ createFx, clearSaveFx }: GameOwner.Props) =>
		Effect.gen(function* () {
			const listeners = new Set<() => void | PromiseLike<void>>();
			const transitionLock = yield* Effect.makeSemaphore(1);
			let current: Game | undefined;
			let failedSaveRecovery: FailedSaveRecovery | undefined;
			let hardResetRecovery: HardResetRecovery | undefined;
			let state: GameOwner.State = {
				type: "loading",
				packageId: null,
			};

			const reportListenerFailure = (error: unknown) => {
				try {
					console.error(
						"Arkini game-owner listener failed; authoritative lifecycle continues.",
						error,
					);
				} catch {
					// Reporting is best effort and must not become another lifecycle failure.
				}
			};

			const publish = (next: GameOwner.State) => {
				state = next;
				for (const listener of Array.from(listeners)) {
					try {
						const result = listener();
						if (result !== undefined) {
							void Promise.resolve(result).catch(reportListenerFailure);
						}
					} catch (error) {
						reportListenerFailure(error);
					}
				}
			};

			const publishCurrentOrIdle = () => {
				if (current === undefined) {
					publish({
						type: "loading",
						packageId: null,
					});
					return;
				}
				publish({
					type: "ready",
					game: current,
				});
			};

			const publishFailureFx = (
				operation: GameOwner.Operation,
				packageId: string | null,
				cause: Cause.Cause<unknown>,
			) => {
				if (Cause.isInterruptedOnly(cause)) {
					return Effect.sync(publishCurrentOrIdle).pipe(
						Effect.zipRight(Effect.failCause(cause)),
					);
				}
				const error = failureFromCause(cause);
				if (error instanceof GameSaveBootstrapError) {
					failedSaveRecovery = {
						key: error.saveKey,
						saveCleared: false,
					};
				}
				publish({
					type: "failed",
					operation,
					game: current ?? null,
					packageId,
					error,
					canRecoverSave: failedSaveRecovery !== undefined,
				});
				return Effect.fail(error);
			};

			const runTransitionFx = (
				operation: GameOwner.Operation,
				getPackageId: () => string | null,
				effect: Effect.Effect<void, unknown>,
			) =>
				transitionLock.withPermits(1)(
					effect.pipe(
						Effect.catchAllCause((cause) =>
							publishFailureFx(operation, getPackageId(), cause),
						),
					),
				);

			const createAndPublishFx = (packageId: string) =>
				Effect.acquireUseRelease(
					createFx(packageId),
					(game) =>
						Effect.sync(() => {
							current = game;
							failedSaveRecovery = undefined;
							hardResetRecovery = undefined;
							publish({
								type: "ready",
								game,
							});
						}),
					(game) =>
						current === game ? Effect.void : Effect.orDie(game.disposeWithoutSaveFx),
				);

			const releaseCurrentFx = (release: "save" | "discard") =>
				Effect.uninterruptible(
					Effect.gen(function* () {
						if (current === undefined) return;
						const releasing = current;
						yield* release === "save"
							? releasing.disposeFx
							: releasing.disposeWithoutSaveFx;
						current = undefined;
					}),
				);

			return {
				getSnapshot: () => state,
				selectPackageFx: (packageId) =>
					runTransitionFx(
						"select-package",
						() => packageId,
						Effect.gen(function* () {
							if (current?.arkpack.packageId === packageId) {
								failedSaveRecovery = undefined;
								hardResetRecovery = undefined;
								publish({
									type: "ready",
									game: current,
								});
								return;
							}
							failedSaveRecovery = undefined;
							hardResetRecovery = undefined;
							publish({
								type: "loading",
								packageId,
							});
							yield* releaseCurrentFx("save");
							yield* createAndPublishFx(packageId);
						}),
					),
				releaseRouteGameFx: () =>
					runTransitionFx(
						"route-release",
						() => null,
						Effect.gen(function* () {
							yield* releaseCurrentFx("save");
							failedSaveRecovery = undefined;
							hardResetRecovery = undefined;
							publish({
								type: "loading",
								packageId: null,
							});
						}),
					),
				shutdownFx: () =>
					runTransitionFx(
						"shutdown",
						() => current?.arkpack.packageId ?? null,
						Effect.gen(function* () {
							publish({
								type: "loading",
								packageId: null,
							});
							yield* releaseCurrentFx("save");
							failedSaveRecovery = undefined;
							hardResetRecovery = undefined;
							publish({
								type: "loading",
								packageId: null,
							});
						}),
					),
				hardResetFx: () =>
					runTransitionFx(
						"hard-reset",
						() => hardResetRecovery?.packageId ?? current?.arkpack.packageId ?? null,
						Effect.gen(function* () {
							let recovery = hardResetRecovery;
							if (recovery === undefined) {
								if (current === undefined) {
									return yield* Effect.fail(
										new Error(
											"A current game or failed hard reset is required.",
										),
									);
								}
								recovery = {
									packageId: current.arkpack.packageId,
									saveKey: current.saveKey,
									discarded: false,
									saveCleared: false,
								};
								hardResetRecovery = recovery;
							}
							failedSaveRecovery = undefined;
							publish({
								type: "loading",
								packageId: recovery.packageId,
							});
							if (!recovery.discarded) {
								yield* releaseCurrentFx("discard");
								recovery = {
									...recovery,
									discarded: true,
								};
								hardResetRecovery = recovery;
							}
							if (!recovery.saveCleared) {
								yield* clearSaveFx(recovery.saveKey);
								recovery = {
									...recovery,
									saveCleared: true,
								};
								hardResetRecovery = recovery;
							}
							yield* createAndPublishFx(recovery.packageId);
							hardResetRecovery = undefined;
						}),
					),
				clearFailedSaveAndRetryFx: () =>
					runTransitionFx(
						"recover-save",
						() => failedSaveRecovery?.key.packageId ?? null,
						Effect.gen(function* () {
							const recovery = failedSaveRecovery;
							hardResetRecovery = undefined;
							if (recovery === undefined) {
								return yield* Effect.fail(
									new Error("A verified failed save is required for recovery."),
								);
							}
							publish({
								type: "loading",
								packageId: recovery.key.packageId,
							});
							if (!recovery.saveCleared) {
								yield* clearSaveFx(recovery.key);
								failedSaveRecovery = {
									key: recovery.key,
									saveCleared: true,
								};
							}
							yield* createAndPublishFx(recovery.key.packageId);
						}),
					),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies GameOwner;
		}),
);
