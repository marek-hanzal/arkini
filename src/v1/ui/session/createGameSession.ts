import { Effect, Exit, Fiber, Layer, ManagedRuntime, Queue, Scope, Stream } from "effect";

import { GameEventsFx } from "~/v1/event/context/GameEventsFx";
import { GameLoopFx } from "~/v1/game/context/GameLoopFx";
import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";
import { GameSessionLayerFx } from "~/v1/game/layer/GameSessionLayerFx";
import { RuntimeChangesFx } from "~/v1/runtime/context/RuntimeChangesFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import type { GameSession } from "~/v1/ui/session/GameSession";
import { RuntimeSaveFx } from "~/v1/ui/save/RuntimeSaveFx";
import { RuntimeSaveLayerFx } from "~/v1/ui/save/RuntimeSaveLayerFx";

export namespace createGameSession {
	export interface Props<SaveError = unknown> {
		config: GameConfigSchema.Type;
		state?: StateSchema.Type;
		tickIntervalMs?: number;
		onTickError?: (cause: unknown) => void;
		save?: {
			debounceMs?: number;
			onError?: (error: SaveError) => void;
			write: (state: StateSchema.Type) => Effect.Effect<void, SaveError>;
		};
	}
}

/** Creates one long-lived browser session shared by React, Tick, save and event consumers. */
export const createGameSession = async <SaveError>({
	config,
	state,
	tickIntervalMs,
	onTickError,
	save,
}: createGameSession.Props<SaveError>): Promise<GameSession> => {
	const sessionLayer = GameSessionLayerFx({
		config,
		state,
		intervalMs: tickIntervalMs,
		onTickError,
	});
	const saveLayer =
		save === undefined
			? Layer.succeed(RuntimeSaveFx, {
					flush: Effect.void,
				})
			: RuntimeSaveLayerFx({
					debounceMs: save.debounceMs,
					onError: save.onError,
					save: save.write,
				}).pipe(Layer.provide(sessionLayer));
	const layer = Layer.merge(sessionLayer, saveLayer);
	const managed = ManagedRuntime.make(layer);
	let snapshot = await managed.runPromise(readRuntimeFx());
	let disposed = false;
	const runtimeListeners = new Set<() => void>();
	const eventListeners = new Set<(batch: GameEventBatchSchema.Type) => void>();

	const runtimeFiber = managed.runFork(
		RuntimeChangesFx.pipe(
			Effect.flatMap((service) =>
				service.changes.pipe(
					Stream.drop(1),
					Stream.runForEach((runtime) =>
						Effect.sync(() => {
							snapshot = runtime;
							for (const listener of runtimeListeners) listener();
						}),
					),
				),
			),
		),
	);

	// Acquire the one session-level PubSub subscription before exposing the
	// session, so the first command cannot outrun its presentation event consumer.
	const eventScope = await managed.runPromise(Scope.make());
	const eventSubscription = await managed.runPromise(
		GameEventsFx.pipe(
			Effect.flatMap((service) => service.subscribe),
			Scope.extend(eventScope),
		),
	);
	const eventFiber = managed.runFork(
		Effect.forever(
			Queue.take(eventSubscription).pipe(
				Effect.tap((batch) =>
					Effect.sync(() => {
						for (const listener of eventListeners) listener(batch);
					}),
				),
			),
		),
	);

	const flushSave = () =>
		managed.runPromise(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush)));

	return {
		dispose: async () => {
			if (disposed) return;
			disposed = true;
			let flushError: unknown;
			await managed.runPromise(GameLoopFx.pipe(Effect.flatMap((service) => service.stop)));
			await managed.runPromise(Fiber.interrupt(runtimeFiber));
			await managed.runPromise(Fiber.interrupt(eventFiber));
			await managed.runPromise(Scope.close(eventScope, Exit.void));
			try {
				await flushSave();
			} catch (error) {
				flushError = error;
			}
			runtimeListeners.clear();
			eventListeners.clear();
			await managed.dispose();
			if (flushError !== undefined) throw flushError;
		},
		flushSave,
		getSnapshot: () => snapshot,
		run: (effect) => {
			if (disposed) return Promise.reject(new Error("Game session is disposed."));
			return managed.runPromise(effect);
		},
		subscribe: (listener) => {
			if (disposed) return () => undefined;
			runtimeListeners.add(listener);
			return () => runtimeListeners.delete(listener);
		},
		subscribeEvents: (listener) => {
			if (disposed) return () => undefined;
			eventListeners.add(listener);
			return () => eventListeners.delete(listener);
		},
	};
};
