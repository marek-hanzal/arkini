import { Effect, Exit, FiberSet, Layer, ManagedRuntime, Scope } from "effect";

import { GameLoopFx } from "~/engine/game/context/GameLoopFx";
import { GameSessionLayerFx } from "~/engine/game/layer/GameSessionLayerFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import type { GameSession, GameSessionServices } from "~/bridge/game/GameSession";
import {
	type GameSessionTransitionSubscriptionCleanup,
	GameSessionTransitionSubscriptionsFx,
} from "~/bridge/game/GameSessionTransitionSubscriptionsFx";
import { RuntimeSaveFx } from "~/bridge/save/RuntimeSaveFx";
import { RuntimeSaveLayerFx } from "~/bridge/save/RuntimeSaveLayerFx";

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

/** Creates one long-lived browser session shared by React, Tick, save and event consumers. */
const createGameSession = async <SaveError>({
	config,
	state,
	tickIntervalMs,
	onTickError,
	save,
}: createGameSessionFx.Props<SaveError>): Promise<GameSession> => {
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
	const layer = Layer.merge(sessionLayer, saveLayer);
	const managed = ManagedRuntime.make(layer);
	const sessionScope = await managed.runPromise(Scope.make());
	const transitionSubscriptions = await managed.runPromise(
		GameSessionTransitionSubscriptionsFx.pipe(Scope.extend(sessionScope)),
	);
	const runCommand = await managed.runPromise(
		FiberSet.makeRuntimePromise<GameSessionServices>().pipe(Scope.extend(sessionScope)),
	);
	let shutdownStarted = false;
	let disposed = false;
	let stopPromise: Promise<void> | undefined;
	let disposePromise: Promise<void> | undefined;

	const flushSave = () =>
		managed.runPromise(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.flush)));
	const discardSave = () =>
		managed.runPromise(RuntimeSaveFx.pipe(Effect.flatMap((service) => service.discard)));
	const stopGameLoop = () => {
		if (stopPromise !== undefined) return stopPromise;
		const pending = managed.runPromise(
			GameLoopFx.pipe(Effect.flatMap((service) => service.stop)),
		);
		stopPromise = pending;
		void pending.catch(() => {
			if (stopPromise === pending) stopPromise = undefined;
		});
		return pending;
	};

	const disposeWithSaveMode = (saveMode: "flush" | "discard") => {
		if (disposePromise !== undefined) return disposePromise;
		if (disposed) return Promise.resolve();

		shutdownStarted = true;
		const pending = (async () => {
			await stopGameLoop();
			if (saveMode === "discard") await discardSave();
			else await flushSave();
			await managed.runPromise(Scope.close(sessionScope, Exit.void));
			await managed.dispose();
			disposed = true;
		})();
		disposePromise = pending;
		void pending.catch(() => {
			if (disposePromise === pending) disposePromise = undefined;
		});

		return pending;
	};

	const dispose = () => disposeWithSaveMode("flush");
	const disposeWithoutSave = () => disposeWithSaveMode("discard");

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
		disposeWithoutSave,
		flushSave,
		getSnapshot: () => managed.runSync(readRuntimeFx()),
		run: (effect) => {
			if (disposed) return Promise.reject(new Error("Game session is disposed."));
			if (shutdownStarted) return Promise.reject(new Error("Game session is shutting down."));
			return runCommand(effect);
		},
		subscribe: (listener) => {
			if (shutdownStarted || disposed) return () => undefined;
			return openSubscription(transitionSubscriptions.subscribe(listener));
		},
		subscribeEvents: (listener) => {
			if (shutdownStarted || disposed) return () => undefined;
			return openSubscription(transitionSubscriptions.subscribeEvents(listener));
		},
	};
};

export const createGameSessionFx = Effect.fn("createGameSessionFx")(
	<SaveError>(props: createGameSessionFx.Props<SaveError>) =>
		Effect.tryPromise({
			try: () => createGameSession(props),
			catch: (cause) => cause,
		}),
);
