import {
	Deferred,
	Effect,
	Exit,
	Fiber,
	FiberSet,
	Layer,
	ManagedRuntime,
	MutableRef,
	Scope,
	Semaphore,
} from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { GameSession, GameSessionServices } from "~/bridge/game/GameSession";
import type { GameSessionFatalSource } from "~/bridge/game/GameSessionFatalError";
import { GameSessionNotRunningError } from "~/bridge/game/GameSessionNotRunningError";
import { createGameSessionFatalSignal } from "~/bridge/game/internal/createGameSessionFatalSignal";
import {
	type GameSessionTransitionSubscriptionCleanup,
	createGameSessionTransitionSubscriptionsFx,
} from "~/bridge/game/createGameSessionTransitionSubscriptionsFx";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";
import { RuntimeSaveLayerFx } from "~/bridge/save/RuntimeSaveLayerFx";
import { GameLoopFx } from "~/engine/game/context/GameLoopFx";
import { GameSessionLayerFx } from "~/engine/game/layer/GameSessionLayerFx";
import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

export namespace createGameSessionFx {
	export interface Props<SaveError = unknown> {
		config: GameConfigSchema.Type;
		state?: StateSchema.Type;
		tickIntervalMs?: number;
		save?: {
			debounceMs?: number;
			write: (state: StateSchema.Type) => Effect.Effect<void, SaveError>;
		};
	}
}

type SessionLifecycle =
	| {
			readonly type: "running";
	  }
	| {
			readonly type: "disposing";
			readonly result: Deferred.Deferred<void, unknown>;
	  }
	| {
			readonly type: "frozen";
	  }
	| {
			readonly type: "disposed";
	  };

type DisposeClaim =
	| {
			readonly type: "complete";
	  }
	| {
			readonly type: "await";
			readonly result: Deferred.Deferred<void, unknown>;
	  }
	| {
			readonly type: "run";
			readonly result: Deferred.Deferred<void, unknown>;
	  };

type CommandClaim<Result, Error> =
	| {
			readonly type: "reject";
			readonly error: GameSessionNotRunningError;
	  }
	| {
			readonly type: "run";
			readonly fiber: Fiber.Fiber<Result, Error>;
	  };

/**
 * Creates one long-lived renderer session shared by React, Tick, save and event consumers.
 *
 * TODO(#397): Revalidate ManagedRuntime, Scope, FiberSet, AbortSignal, and Cause semantics
 * against stable Effect while preserving exactly-once bootstrap and disposal cleanup.
 */
export const createGameSessionFx = Effect.fn("createGameSessionFx")(
	<SaveError>({ config, state, tickIntervalMs, save }: createGameSessionFx.Props<SaveError>) =>
		Effect.uninterruptibleMask((restore) =>
			Effect.gen(function* () {
				const ownerScope = yield* Scope.make();
				const lifecycle = MutableRef.make<SessionLifecycle>({
					type: "running",
				});
				const fatalSignal = createGameSessionFatalSignal();
				let quiesceFatalSession = () => undefined;
				let fatalQuiesceStarted = false;
				const failStop = (source: GameSessionFatalSource, cause: unknown) => {
					const publication = fatalSignal.report(source, cause, () => {
						if (MutableRef.get(lifecycle).type === "running") {
							MutableRef.set(lifecycle, {
								type: "frozen",
							});
						}
						quiesceFatalSession();
					});
					return publication.error;
				};
				const sessionLayer = GameSessionLayerFx({
					config,
					state,
					intervalMs: tickIntervalMs,
					onFatalError: (cause) => failStop("tick", cause),
				});
				const saveLayer =
					save === undefined
						? Layer.succeed(RuntimeSaveFx, {
								discard: Effect.void,
								flush: Effect.void,
							})
						: RuntimeSaveLayerFx({
								debounceMs: save.debounceMs,
								onFatalError: (cause) => failStop("autosave", cause),
								save: save.write,
							}).pipe(Layer.provide(sessionLayer));
				const managed = ManagedRuntime.make(Layer.merge(sessionLayer, saveLayer));
				yield* Scope.addFinalizer(ownerScope, managed.disposeEffect);

				const initializeFx = Effect.gen(function* () {
					const runManagedFx = <Result, Error>(
						effect: Effect.Effect<Result, Error, GameSessionServices>,
					): Effect.Effect<Result, unknown> =>
						Effect.tryPromise({
							try: (signal) =>
								managed.runPromise(effect, {
									signal,
								}),
							catch: (cause) => cause,
						});
					const sessionScope = yield* Scope.fork(ownerScope, "sequential");
					const commandScope = yield* Scope.fork(ownerScope, "sequential");
					const transitionSubscriptions = yield* runManagedFx(
						createGameSessionTransitionSubscriptionsFx((cause) =>
							failStop("subscription", cause),
						).pipe(Scope.provide(sessionScope)),
					);
					const committedTransitions = yield* runManagedFx(CommittedTransitionsFx);
					const committedTransitionSubscriptionAtom = Atom.subscriptionRef(
						committedTransitions.ref,
					);
					const committedTransitionAtom: Atom.Atom<CommittedTransitionSchema.Type> =
						Atom.readable((get) => get(committedTransitionSubscriptionAtom));
					const runCommand = yield* runManagedFx(
						FiberSet.makeRuntime<GameSessionServices>().pipe(
							Scope.provide(commandScope),
						),
					);
					const lifecycleLock = yield* Semaphore.make(1);

					const flushSaveFx = runManagedFx(
						RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush)),
					);
					const discardSaveFx = runManagedFx(
						RuntimeSaveFx.pipe(Effect.flatMap((service) => service.discard)),
					);
					const stopGameLoopFx = runManagedFx(
						GameLoopFx.pipe(Effect.flatMap((service) => service.stop)),
					);
					const stopCommandsFx = Scope.close(commandScope, Exit.void);
					const stopTransitionSubscriptionsFx = Scope.close(sessionScope, Exit.void);
					const releaseSessionFx = Scope.close(ownerScope, Exit.void);
					quiesceFatalSession = () => {
						if (fatalQuiesceStarted) return;
						fatalQuiesceStarted = true;
						managed.runFork(
							stopGameLoopFx.pipe(
								Effect.andThen(stopCommandsFx),
								Effect.andThen(stopTransitionSubscriptionsFx),
							),
						);
					};
					if (fatalSignal.getSnapshot() !== null) quiesceFatalSession();

					const claimDisposeFx = lifecycleLock.withPermits(1)(
						Effect.gen(function* () {
							const current = MutableRef.get(lifecycle);
							if (current.type === "disposed") {
								return {
									type: "complete",
								} satisfies DisposeClaim;
							}
							if (current.type === "disposing") {
								return {
									type: "await",
									result: current.result,
								} satisfies DisposeClaim;
							}
							const result = yield* Deferred.make<void, unknown>();
							MutableRef.set(lifecycle, {
								type: "disposing",
								result,
							});
							return {
								type: "run",
								result,
							} satisfies DisposeClaim;
						}),
					);

					const disposeWithSaveModeFx = (saveMode: "flush" | "discard") =>
						Effect.uninterruptibleMask((restore) =>
							Effect.gen(function* () {
								const claim = yield* claimDisposeFx;
								if (claim.type === "complete") return;
								if (claim.type === "await") {
									return yield* restore(Deferred.await(claim.result));
								}

								/**
								 * Quiesce every runtime producer before observing the final
								 * save. Reordering flush ahead of command-scope closure can
								 * persist a snapshot while an admitted command is still committing.
								 */
								const attempt = stopGameLoopFx.pipe(
									Effect.andThen(stopCommandsFx),
									Effect.andThen(
										saveMode === "discard" ? discardSaveFx : flushSaveFx,
									),
									Effect.andThen(releaseSessionFx),
								);
								const exit = yield* Effect.exit(attempt);
								yield* lifecycleLock.withPermits(1)(
									Effect.sync(() => {
										MutableRef.set(lifecycle, {
											type: Exit.isSuccess(exit) ? "disposed" : "frozen",
										});
									}),
								);
								yield* Deferred.done(claim.result, exit);
								if (Exit.isFailure(exit))
									return yield* Effect.failCause(exit.cause);
							}),
						);

					const runFx = <Result, CommandError, Requirements extends GameSessionServices>(
						effect: Effect.Effect<Result, CommandError, Requirements>,
					): Effect.Effect<Result, CommandError | GameSessionNotRunningError> =>
						Effect.uninterruptibleMask((restore) =>
							Effect.sync((): CommandClaim<Result, CommandError> => {
								const current = MutableRef.get(lifecycle);
								if (current.type !== "running") {
									return {
										type: "reject",
										error: new GameSessionNotRunningError({
											message:
												current.type === "disposed"
													? "Game session is disposed."
													: "Game session is shutting down.",
											state: current.type,
										}),
									};
								}

								return {
									type: "run",
									fiber: runCommand(effect),
								};
							}).pipe(
								Effect.flatMap(
									(
										claim,
									): Effect.Effect<
										Result,
										CommandError | GameSessionNotRunningError
									> => {
										if (claim.type === "reject")
											return Effect.fail(claim.error);

										return restore(Fiber.join(claim.fiber)).pipe(
											Effect.onInterrupt(() => Fiber.interrupt(claim.fiber)),
										);
									},
								),
							),
						);
					const openSubscription = (
						effect: Effect.Effect<GameSessionTransitionSubscriptionCleanup>,
					) => {
						// Admit new observers only while the session can still publish commands.
						if (MutableRef.get(lifecycle).type !== "running") return () => undefined;
						const cleanup = managed.runSync(effect);
						let closed = false;

						return () => {
							if (closed || MutableRef.get(lifecycle).type === "disposed") return;
							closed = true;
							managed.runSync(cleanup.close);
						};
					};

					return {
						disposeFx: disposeWithSaveModeFx("flush"),
						disposeWithoutSaveFx: disposeWithSaveModeFx("discard"),
						flushSaveFx,
						committedTransitionAtom,
						failStop,
						getFatalError: fatalSignal.getSnapshot,
						getSnapshot: () => committedTransitions.readUnsafe().runtime,
						getTransitionSnapshot: committedTransitions.readUnsafe,
						read: (effect) => {
							const current = MutableRef.get(lifecycle);
							return current.type === "running"
								? managed.runSyncExit(effect)
								: Exit.fail(
										new GameSessionNotRunningError({
											message:
												current.type === "disposed"
													? "Game session is disposed."
													: "Game session is shutting down.",
											state: current.type,
										}),
									);
						},
						runFx,
						run: (effect) => Effect.runPromise(runFx(effect)),
						subscribe: (listener) =>
							openSubscription(transitionSubscriptions.subscribe(listener)),
						subscribeTransitions: (listener) =>
							openSubscription(
								transitionSubscriptions.subscribeTransitions(listener),
							),
						subscribeEvents: (listener) =>
							openSubscription(transitionSubscriptions.subscribeEvents(listener)),
						subscribeFatalError: fatalSignal.subscribe,
					} satisfies GameSession;
				});

				return yield* restore(initializeFx).pipe(
					Effect.onExit((exit) =>
						Exit.isFailure(exit) ? Scope.close(ownerScope, exit) : Effect.void,
					),
				);
			}),
		),
);
