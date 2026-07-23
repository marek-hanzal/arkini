import { Deferred, Effect, Exit, FiberSet, Layer, ManagedRuntime, MutableRef, Scope } from "effect";

import type { GameSession, GameSessionServices } from "~/bridge/game/GameSession";
import {
	type GameSessionTransitionSubscriptionCleanup,
	GameSessionTransitionSubscriptionsFx,
} from "~/bridge/game/GameSessionTransitionSubscriptionsFx";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";
import { RuntimeSaveLayerFx } from "~/bridge/save/RuntimeSaveLayerFx";
import { GameLoopFx } from "~/engine/game/context/GameLoopFx";
import { GameSessionLayerFx } from "~/engine/game/layer/GameSessionLayerFx";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

export namespace createGameSessionFx {
	export interface Props<SaveError = unknown> {
		config: GameConfigSchema.Type;
		state?: StateSchema.Type;
		tickIntervalMs?: number;
		onTickError?: (cause: unknown) => void | PromiseLike<void>;
		save?: {
			debounceMs?: number;
			onError?: (error: SaveError) => void | PromiseLike<void>;
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

/** Creates one long-lived renderer session shared by React, Tick, save and event consumers. */
export const createGameSessionFx = Effect.fn("createGameSessionFx")(
	<SaveError>({
		config,
		state,
		tickIntervalMs,
		onTickError,
		save,
	}: createGameSessionFx.Props<SaveError>) =>
		Effect.gen(function* () {
			const sessionLayer = GameSessionLayerFx({
				config,
				state,
				intervalMs: tickIntervalMs,
				onTickError,
			});
			const saveLayer =
				save === undefined
					? Layer.succeed(RuntimeSaveFx, {
							discard: Effect.void,
							flush: Effect.void,
						})
					: RuntimeSaveLayerFx({
							debounceMs: save.debounceMs,
							onError: save.onError,
							save: save.write,
						}).pipe(Layer.provide(sessionLayer));
			const managed = ManagedRuntime.make(Layer.merge(sessionLayer, saveLayer));
			const runManagedFx = <Result, Error>(
				effect: Effect.Effect<Result, Error, GameSessionServices>,
			): Effect.Effect<Result, unknown> =>
				Effect.tryPromise({
					try: () => managed.runPromise(effect),
					catch: (cause) => cause,
				});
			const sessionScope = yield* runManagedFx(Scope.make());
			const transitionSubscriptions = yield* runManagedFx(
				GameSessionTransitionSubscriptionsFx.pipe(Scope.extend(sessionScope)),
			);
			const runCommand = yield* runManagedFx(
				FiberSet.makeRuntimePromise<GameSessionServices>().pipe(Scope.extend(sessionScope)),
			);
			const lifecycle = MutableRef.make<SessionLifecycle>({
				type: "running",
			});
			const lastTilePresentationSequence = MutableRef.make(-1);
			const lifecycleLock = yield* Effect.makeSemaphore(1);

			const flushSaveFx = runManagedFx(
				RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush)),
			);
			const discardSaveFx = runManagedFx(
				RuntimeSaveFx.pipe(Effect.flatMap((service) => service.discard)),
			);
			const stopGameLoopFx = runManagedFx(
				GameLoopFx.pipe(Effect.flatMap((service) => service.stop)),
			);
			const releaseSessionFx = runManagedFx(Scope.close(sessionScope, Exit.void)).pipe(
				Effect.zipRight(
					Effect.tryPromise({
						try: () => managed.dispose(),
						catch: (cause) => cause,
					}),
				),
			);

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

						const attempt = stopGameLoopFx.pipe(
							Effect.zipRight(saveMode === "discard" ? discardSaveFx : flushSaveFx),
							Effect.zipRight(releaseSessionFx),
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
						if (Exit.isFailure(exit)) return yield* Effect.failCause(exit.cause);
					}),
				);

			const ensureRunningFx = Effect.suspend(() => {
				const current = MutableRef.get(lifecycle);
				if (current.type === "disposed") {
					return Effect.fail(new Error("Game session is disposed."));
				}
				if (current.type !== "running") {
					return Effect.fail(new Error("Game session is shutting down."));
				}
				return Effect.void;
			});
			const openSubscription = (
				effect: Effect.Effect<GameSessionTransitionSubscriptionCleanup>,
			) => {
				if (MutableRef.get(lifecycle).type !== "running") return () => undefined;
				const cleanup = managed.runSync(effect);
				let closed = false;

				return () => {
					if (closed || MutableRef.get(lifecycle).type === "disposed") return;
					closed = true;
					managed.runSync(cleanup.shutdown);
					managed.runFork(cleanup.release);
				};
			};

			return {
				disposeFx: disposeWithSaveModeFx("flush"),
				disposeWithoutSaveFx: disposeWithSaveModeFx("discard"),
				flushSaveFx,
				getSnapshot: () => managed.runSync(readRuntimeFx()),
				getTransitionSnapshot: () => managed.runSync(readCommittedTransitionFx()),
				claimTilePresentationTransition: (sequence) => {
					const previous = MutableRef.get(lastTilePresentationSequence);
					if (sequence <= previous) return false;
					MutableRef.set(lastTilePresentationSequence, sequence);
					return true;
				},
				read: (effect) => managed.runSyncExit(effect),
				run: (effect) => runCommand(ensureRunningFx.pipe(Effect.zipRight(effect))),
				subscribe: (listener) =>
					openSubscription(transitionSubscriptions.subscribe(listener)),
				subscribeTransitions: (listener) =>
					openSubscription(transitionSubscriptions.subscribeTransitions(listener)),
				subscribeEvents: (listener) =>
					openSubscription(transitionSubscriptions.subscribeEvents(listener)),
			} satisfies GameSession;
		}),
);
