import { Cause, Effect, Exit, Option, Runtime } from "effect";
import type { Game } from "~/bridge/game/Game";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

export namespace createGameOwnerFx {
	export type State =
		| {
				readonly type: "loading";
				readonly packageId: string | null;
		  }
		| {
				readonly type: "ready";
				readonly game: Game;
		  }
		| {
				readonly type: "failed";
				readonly packageId: string | null;
				readonly error: unknown;
				readonly canForceShutdown: boolean;
				readonly saveRecoveryKey?: GameSaveStorage.Key;
		  };

	export interface Props {
		readonly createFx: (packageId: string) => Effect.Effect<Game, unknown>;
		readonly clearSaveFx: (key: GameSaveStorage.Key) => Effect.Effect<void, unknown>;
	}

	export interface Owner {
		readonly getSnapshot: () => State;
		readonly replaceFx: (packageId: string | null) => Effect.Effect<void, unknown>;
		readonly clearFailedSaveAndRetryFx: () => Effect.Effect<void, unknown>;
		readonly hardResetFx: () => Effect.Effect<void, unknown>;
		readonly forceShutdownFx: () => Effect.Effect<void, unknown>;
		readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
	}
}

const toEffect = (operation: () => Promise<void>) =>
	Effect.tryPromise({
		try: operation,
		catch: (cause) => cause,
	});

/** Serializes one shell's exclusive ownership of replaceable live game instances. */
export const createGameOwnerFx = Effect.fn("createGameOwnerFx")(
	({ createFx, clearSaveFx }: createGameOwnerFx.Props) =>
		Effect.gen(function* () {
			const runtime = yield* Effect.runtime<never>();
			const runPromise = <Value>(effect: Effect.Effect<Value, unknown>) =>
				Runtime.runPromiseExit(runtime)(effect).then((exit) => {
					if (Exit.isSuccess(exit)) return exit.value;
					const failure = Cause.failureOption(exit.cause);
					if (Option.isSome(failure)) throw failure.value;
					throw Cause.squash(exit.cause);
				});
			const listeners = new Set<() => void | PromiseLike<void>>();
			let requestedPackageId: string | null = null;
			let requestedHardReset = false;
			let requestedForceShutdown = false;
			let requestedSaveRecoveryKey: GameSaveStorage.Key | undefined;
			let requestVersion = 0;
			let settledVersion = 0;
			let current: Game | undefined;
			let running: Promise<void> | undefined;
			let state: createGameOwnerFx.State = {
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

			const publish = (next: createGameOwnerFx.State) => {
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

			const fail = (
				version: number,
				error: unknown,
				saveRecoveryKey?: GameSaveStorage.Key,
			) => {
				settledVersion = version;
				publish({
					type: "failed",
					packageId: requestedPackageId,
					error,
					canForceShutdown:
						requestedPackageId === null && current !== undefined && !requestedHardReset,
					...(saveRecoveryKey === undefined
						? {}
						: {
								saveRecoveryKey,
							}),
				});
			};

			const drain = async () => {
				while (settledVersion !== requestVersion) {
					const version = requestVersion;
					const packageId = requestedPackageId;

					if (current !== undefined) {
						const releasing = current;
						const hardReset =
							requestedHardReset && packageId === releasing.arkpack.packageId;
						const forceShutdown = requestedForceShutdown && packageId === null;
						try {
							if (hardReset) {
								await releasing.disposeWithoutSave();
								await runPromise(clearSaveFx(releasing.saveKey));
								requestedHardReset = false;
							} else if (forceShutdown) {
								await releasing.disposeWithoutSave();
								requestedForceShutdown = false;
							} else {
								await releasing.dispose();
							}
							current = undefined;
						} catch (error) {
							fail(requestVersion, error);
							return;
						}
						continue;
					}

					if (requestedSaveRecoveryKey !== undefined) {
						const recoveryKey = requestedSaveRecoveryKey;
						try {
							await runPromise(clearSaveFx(recoveryKey));
						} catch (error) {
							if (version !== requestVersion) continue;
							requestedSaveRecoveryKey = undefined;
							fail(version, error, recoveryKey);
							return;
						}
						if (requestedSaveRecoveryKey === recoveryKey) {
							requestedSaveRecoveryKey = undefined;
						}
						if (version !== requestVersion) continue;
					}

					if (packageId === null) {
						settledVersion = version;
						publish({
							type: "loading",
							packageId: null,
						});
						return;
					}

					publish({
						type: "loading",
						packageId,
					});
					let created: Game;
					try {
						created = await runPromise(createFx(packageId));
					} catch (error) {
						if (version !== requestVersion) continue;
						fail(
							version,
							error,
							error instanceof GameSaveBootstrapError ? error.saveKey : undefined,
						);
						return;
					}

					if (version !== requestVersion || requestedPackageId !== packageId) {
						try {
							await created.dispose();
						} catch (error) {
							fail(requestVersion, error);
							return;
						}
						continue;
					}

					current = created;
					settledVersion = version;
					publish({
						type: "ready",
						game: created,
					});
				}
			};

			const ensureRunning = () => {
				if (running === undefined) {
					running = drain().finally(() => {
						running = undefined;
						if (settledVersion !== requestVersion) void ensureRunning();
					});
				}
				return running;
			};

			const replace = (packageId: string | null) => {
				if (
					!requestedHardReset &&
					!requestedForceShutdown &&
					packageId === requestedPackageId &&
					settledVersion === requestVersion &&
					((packageId === null &&
						current === undefined &&
						state.type === "loading" &&
						state.packageId === null) ||
						(packageId !== null &&
							current?.arkpack.packageId === packageId &&
							state.type === "ready"))
				) {
					return Promise.resolve();
				}
				requestedPackageId = packageId;
				requestedHardReset = false;
				requestedForceShutdown = false;
				requestedSaveRecoveryKey = undefined;
				requestVersion += 1;
				if (packageId !== null) {
					publish({
						type: "loading",
						packageId,
					});
				}
				return ensureRunning();
			};

			const clearFailedSaveAndRetry = () => {
				if (requestedSaveRecoveryKey !== undefined) return ensureRunning();
				if (state.type !== "failed" || state.saveRecoveryKey === undefined) {
					return Promise.reject(
						new Error("A verified failed save is required for recovery."),
					);
				}
				requestedPackageId = state.saveRecoveryKey.packageId;
				requestedHardReset = false;
				requestedForceShutdown = false;
				requestedSaveRecoveryKey = state.saveRecoveryKey;
				requestVersion += 1;
				publish({
					type: "loading",
					packageId: requestedPackageId,
				});
				return ensureRunning();
			};

			const hardReset = () => {
				if (requestedHardReset) return ensureRunning();
				if (current === undefined || state.type !== "ready") {
					return Promise.reject(new Error("A ready game is required for hard reset."));
				}
				requestedPackageId = current.arkpack.packageId;
				requestedHardReset = true;
				requestedForceShutdown = false;
				requestedSaveRecoveryKey = undefined;
				requestVersion += 1;
				publish({
					type: "loading",
					packageId: requestedPackageId,
				});
				return ensureRunning();
			};

			const forceShutdown = () => {
				if (requestedForceShutdown) return ensureRunning();
				if (current === undefined) return Promise.resolve();
				requestedPackageId = null;
				requestedHardReset = false;
				requestedForceShutdown = true;
				requestedSaveRecoveryKey = undefined;
				requestVersion += 1;
				publish({
					type: "loading",
					packageId: null,
				});
				return ensureRunning();
			};

			return {
				getSnapshot: () => state,
				replaceFx: (packageId) => toEffect(() => replace(packageId)),
				clearFailedSaveAndRetryFx: () => toEffect(clearFailedSaveAndRetry),
				hardResetFx: () => toEffect(hardReset),
				forceShutdownFx: () => toEffect(forceShutdown),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies createGameOwnerFx.Owner;
		}),
);
