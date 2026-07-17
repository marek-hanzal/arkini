import { Cause, Deferred, Effect, Exit, Option, Queue } from "effect";
import type { Game } from "~/bridge/game/Game";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import type { GameSaveStorage } from "~/bridge/save/GameSaveStorage";

type CommandInput =
	| {
			readonly type: "replace";
			readonly packageId: string | null;
	  }
	| {
			readonly type: "hard-reset" | "recover-save" | "force-shutdown";
	  };

type Command = CommandInput & {
	readonly result: Deferred.Deferred<void, unknown>;
};

type Intent = {
	readonly type: CommandInput["type"];
	readonly packageId: string | null;
	readonly release: "save" | "discard";
	readonly clearSaveKey?: GameSaveStorage.Key;
};

const sameSaveKey = (
	left: GameSaveStorage.Key | undefined,
	right: GameSaveStorage.Key | undefined,
) =>
	left === right ||
	(left !== undefined &&
		right !== undefined &&
		left.packageId === right.packageId &&
		left.contentHash === right.contentHash);

const sameIntent = (left: Intent, right: Intent) =>
	left.type === right.type &&
	left.packageId === right.packageId &&
	left.release === right.release &&
	sameSaveKey(left.clearSaveKey, right.clearSaveKey);

const failureFromCause = (cause: Cause.Cause<unknown>) => {
	const failure = Cause.failureOption(cause);
	return Option.isSome(failure) ? failure.value : Cause.squash(cause);
};

/** Serializes one shell's exclusive ownership of replaceable live game instances. */
export const createGameOwnerFx = Effect.fn("createGameOwnerFx")(
	({ createFx, clearSaveFx }: GameOwner.Props) =>
		Effect.gen(function* () {
			const listeners = new Set<() => void | PromiseLike<void>>();
			const commands = yield* Queue.unbounded<Command>();
			const drainLock = yield* Effect.makeSemaphore(1);
			let current: Game | undefined;
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

			const drainCommandsFx = Effect.gen(function* () {
				let intent: Intent | undefined;
				const pending: Array<Deferred.Deferred<void, unknown>> = [];

				const completePendingFx = (exit: Exit.Exit<void, unknown>) =>
					Effect.forEach(pending.splice(0), (result) => Deferred.done(result, exit), {
						discard: true,
					});

				const failPendingFx = (error: unknown, saveRecoveryKey?: GameSaveStorage.Key) =>
					Effect.gen(function* () {
						publish({
							type: "failed",
							packageId: intent?.packageId ?? null,
							error,
							canForceShutdown:
								intent?.packageId === null &&
								current !== undefined &&
								intent.type !== "hard-reset",
							...(saveRecoveryKey === undefined
								? {}
								: {
										saveRecoveryKey,
									}),
						});
						yield* completePendingFx(Exit.fail(error));
						intent = undefined;
					});

				// Commands absorbed into one drain share the final winning intent's outcome.
				const joinIntent = (next: Intent, result: Deferred.Deferred<void, unknown>) => {
					if (intent === undefined || !sameIntent(intent, next)) intent = next;
					pending.push(result);
					if (next.packageId !== null)
						publish({
							type: "loading",
							packageId: next.packageId,
						});
				};

				const rejectCommandFx = (command: Command, message: string) =>
					Deferred.fail(command.result, new Error(message));

				const absorbCommandFx = (command: Command) =>
					Effect.gen(function* () {
						switch (command.type) {
							case "replace": {
								const settledSamePackage =
									intent === undefined &&
									((command.packageId === null &&
										current === undefined &&
										state.type === "loading" &&
										state.packageId === null) ||
										(command.packageId !== null &&
											current?.arkpack.packageId === command.packageId &&
											state.type === "ready"));
								if (settledSamePackage) {
									yield* Deferred.succeed(command.result, undefined);
									return;
								}
								joinIntent(
									{
										type: "replace",
										packageId: command.packageId,
										release: "save",
									},
									command.result,
								);
								return;
							}
							case "hard-reset":
								if (intent?.type === "hard-reset") {
									pending.push(command.result);
									return;
								}
								if (current === undefined || state.type !== "ready") {
									yield* rejectCommandFx(
										command,
										"A ready game is required for hard reset.",
									);
									return;
								}
								joinIntent(
									{
										type: "hard-reset",
										packageId: current.arkpack.packageId,
										release: "discard",
										clearSaveKey: current.saveKey,
									},
									command.result,
								);
								return;
							case "recover-save":
								if (intent?.type === "recover-save") {
									pending.push(command.result);
									return;
								}
								if (
									state.type !== "failed" ||
									state.saveRecoveryKey === undefined
								) {
									yield* rejectCommandFx(
										command,
										"A verified failed save is required for recovery.",
									);
									return;
								}
								joinIntent(
									{
										type: "recover-save",
										packageId: state.saveRecoveryKey.packageId,
										release: "save",
										clearSaveKey: state.saveRecoveryKey,
									},
									command.result,
								);
								return;
							case "force-shutdown":
								if (intent === undefined && current === undefined) {
									yield* Deferred.succeed(command.result, undefined);
									return;
								}
								joinIntent(
									{
										type: "force-shutdown",
										packageId: null,
										release: "discard",
									},
									command.result,
								);
								publish({
									type: "loading",
									packageId: null,
								});
						}
					});

				const absorbWaitingFx = commands.takeAll.pipe(
					Effect.flatMap((waiting) =>
						Effect.forEach(waiting, absorbCommandFx, {
							discard: true,
						}),
					),
				);
				const checkpointFx = <Value>(effect: Effect.Effect<Value, unknown>) =>
					Effect.exit(effect).pipe(Effect.tap(absorbWaitingFx));

				const disposeStaleGameFx = (game: Game) =>
					Effect.gen(function* () {
						const exit = yield* checkpointFx(game.disposeFx);
						if (Exit.isFailure(exit))
							yield* failPendingFx(failureFromCause(exit.cause));
					});

				yield* absorbCommandFx(yield* commands.take);
				while (intent !== undefined) {
					const requested = intent;
					if (
						current !== undefined &&
						requested.type === "replace" &&
						requested.packageId === current.arkpack.packageId &&
						state.type === "ready"
					) {
						yield* absorbWaitingFx;
						if (intent === requested) {
							yield* completePendingFx(Exit.void);
							intent = undefined;
						}
						continue;
					}

					if (current !== undefined) {
						const releasing = current;
						const exit = yield* checkpointFx(
							requested.release === "discard"
								? releasing.disposeWithoutSaveFx
								: releasing.disposeFx,
						);
						if (Exit.isFailure(exit)) {
							yield* failPendingFx(failureFromCause(exit.cause));
							continue;
						}
						current = undefined;
						if (intent !== requested) continue;
					}

					if (requested.clearSaveKey !== undefined) {
						const exit = yield* checkpointFx(clearSaveFx(requested.clearSaveKey));
						if (Exit.isFailure(exit)) {
							if (intent !== requested && requested.type === "recover-save") continue;
							yield* failPendingFx(
								failureFromCause(exit.cause),
								requested.type === "recover-save"
									? requested.clearSaveKey
									: undefined,
							);
							continue;
						}
						if (intent !== requested) continue;
					}

					if (requested.packageId === null) {
						publish({
							type: "loading",
							packageId: null,
						});
						yield* absorbWaitingFx;
						if (intent === requested) {
							yield* completePendingFx(Exit.void);
							intent = undefined;
						}
						continue;
					}

					publish({
						type: "loading",
						packageId: requested.packageId,
					});
					const createExit = yield* checkpointFx(createFx(requested.packageId));
					if (Exit.isFailure(createExit)) {
						if (intent !== requested) continue;
						const error = failureFromCause(createExit.cause);
						yield* failPendingFx(
							error,
							error instanceof GameSaveBootstrapError ? error.saveKey : undefined,
						);
						continue;
					}
					if (intent !== requested) {
						yield* disposeStaleGameFx(createExit.value);
						continue;
					}

					current = createExit.value;
					publish({
						type: "ready",
						game: createExit.value,
					});
					yield* absorbWaitingFx;
					if (intent === requested) {
						yield* completePendingFx(Exit.void);
						intent = undefined;
					}
				}
			});

			const submitFx = (command: CommandInput) =>
				Effect.uninterruptibleMask((restore) =>
					Effect.gen(function* () {
						const result = yield* Deferred.make<void, unknown>();
						yield* commands.offer({
							...command,
							result,
						} as Command);
						yield* drainLock.withPermits(1)(
							Deferred.isDone(result).pipe(
								Effect.flatMap((done) => (done ? Effect.void : drainCommandsFx)),
							),
						);
						yield* restore(Deferred.await(result));
					}),
				);

			return {
				getSnapshot: () => state,
				replaceFx: (packageId) =>
					submitFx({
						type: "replace",
						packageId,
					}),
				clearFailedSaveAndRetryFx: () =>
					submitFx({
						type: "recover-save",
					}),
				hardResetFx: () =>
					submitFx({
						type: "hard-reset",
					}),
				forceShutdownFx: () =>
					submitFx({
						type: "force-shutdown",
					}),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies GameOwner;
		}),
);
