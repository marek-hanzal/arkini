import { Effect, Exit, FiberSet, Layer, ManagedRuntime, Scope } from "effect";

import { GameLoopFx } from "~/v1/game/context/GameLoopFx";
import { GameSessionLayerFx } from "~/v1/game/layer/GameSessionLayerFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import type { GameSession, GameSessionServices } from "~/v1/ui/session/GameSession";
import {
	type GameSessionTransitionSubscriptionCleanup,
	GameSessionTransitionSubscriptionsFx,
} from "~/v1/ui/session/GameSessionTransitionSubscriptionsFx";
import { RuntimeSaveFx } from "~/v1/ui/save/RuntimeSaveFx";
import { RuntimeSaveLayerFx } from "~/v1/ui/save/RuntimeSaveLayerFx";

export namespace createGameSession {
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
	const sessionScope = await managed.runPromise(Scope.make());
	const transitionSubscriptions = await managed.runPromise(
		GameSessionTransitionSubscriptionsFx.pipe(Scope.extend(sessionScope)),
	);
	const runCommand = await managed.runPromise(
		FiberSet.makeRuntimePromise<GameSessionServices>().pipe(Scope.extend(sessionScope)),
	);
	let disposed = false;
	let disposePromise: Promise<void> | undefined;

	const flushSave = () =>
		managed.runPromise(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush)));

	const dispose = () => {
		if (disposePromise !== undefined) return disposePromise;

		disposed = true;
		disposePromise = (async () => {
			let flushError: unknown;
			await managed.runPromise(GameLoopFx.pipe(Effect.flatMap((service) => service.stop)));
			await managed.runPromise(Scope.close(sessionScope, Exit.void));
			try {
				await flushSave();
			} catch (error) {
				flushError = error;
			}
			await managed.dispose();
			if (flushError !== undefined) throw flushError;
		})();

		return disposePromise;
	};

	const openSubscription = (effect: Effect.Effect<GameSessionTransitionSubscriptionCleanup>) => {
		const cleanup = managed.runSync(effect);
		let closed = false;

		return () => {
			if (closed || disposed) return;
			closed = true;
			managed.runSync(cleanup.shutdown);
			managed.runFork(cleanup.release);
		};
	};

	return {
		dispose,
		flushSave,
		getSnapshot: () => managed.runSync(readRuntimeFx()),
		run: (effect) => {
			if (disposed) return Promise.reject(new Error("Game session is disposed."));
			return runCommand(effect);
		},
		subscribe: (listener) => {
			if (disposed) return () => undefined;
			return openSubscription(transitionSubscriptions.subscribe(listener));
		},
		subscribeEvents: (listener) => {
			if (disposed) return () => undefined;
			return openSubscription(transitionSubscriptions.subscribeEvents(listener));
		},
	};
};
