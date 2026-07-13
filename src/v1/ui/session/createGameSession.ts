import { Effect, Exit, Fiber, FiberSet, Layer, ManagedRuntime, Scope, Stream } from "effect";

import { invokeExternalCallbackFx } from "~/v1/common/fx/invokeExternalCallbackFx";
import { GameLoopFx } from "~/v1/game/context/GameLoopFx";
import type { GameEventBatchSchema } from "~/v1/event/schema/GameEventBatchSchema";
import { GameSessionLayerFx } from "~/v1/game/layer/GameSessionLayerFx";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import type { GameSession, GameSessionServices } from "~/v1/ui/session/GameSession";
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
	const commandScope = await managed.runPromise(Scope.make());
	const runCommand = await managed.runPromise(
		FiberSet.makeRuntimePromise<GameSessionServices>().pipe(Scope.extend(commandScope)),
	);
	let snapshot = await managed.runPromise(readRuntimeFx());
	let disposed = false;
	let disposePromise: Promise<void> | undefined;
	const runtimeListeners = new Set<() => void>();
	const eventListeners = new Set<(batch: GameEventBatchSchema.Type) => void>();

	const transitionFiber = managed.runFork(
		CommittedTransitionsFx.pipe(
			Effect.flatMap((service) =>
				service.changes.pipe(
					Stream.runForEach((transition) =>
						Effect.gen(function* () {
							snapshot = transition.runtime;
							yield* Effect.forEach(
								[
									...runtimeListeners,
								],
								(listener) =>
									invokeExternalCallbackFx({
										callback: listener,
										failureMessage:
											"Arkini runtime listener failed; remaining session listeners continue.",
										value: undefined,
									}),
								{
									discard: true,
								},
							);

							if (transition.events.length === 0) return;

							const batch = {
								events: transition.events,
							};
							yield* Effect.forEach(
								[
									...eventListeners,
								],
								(listener) =>
									invokeExternalCallbackFx({
										callback: listener,
										failureMessage:
											"Arkini event listener failed; remaining session listeners continue.",
										value: batch,
									}),
								{
									discard: true,
								},
							);
						}),
					),
				),
			),
		),
	);

	const flushSave = () =>
		managed.runPromise(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush)));

	const dispose = () => {
		if (disposePromise !== undefined) return disposePromise;

		disposed = true;
		disposePromise = (async () => {
			let flushError: unknown;
			await managed.runPromise(GameLoopFx.pipe(Effect.flatMap((service) => service.stop)));
			await managed.runPromise(Scope.close(commandScope, Exit.void));
			await managed.runPromise(Fiber.interrupt(transitionFiber));
			try {
				await flushSave();
			} catch (error) {
				flushError = error;
			}
			runtimeListeners.clear();
			eventListeners.clear();
			await managed.dispose();
			if (flushError !== undefined) throw flushError;
		})();

		return disposePromise;
	};

	return {
		dispose,
		flushSave,
		getSnapshot: () => snapshot,
		run: (effect) => {
			if (disposed) return Promise.reject(new Error("Game session is disposed."));
			return runCommand(effect);
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
