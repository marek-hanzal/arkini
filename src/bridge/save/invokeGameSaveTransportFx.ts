import { Effect } from "effect";
import { GameSaveStorageError } from "~/bridge/save/GameSaveStorageError";

/** Adapts one typed preload save Promise into the renderer Effect error channel. */
export const invokeGameSaveTransportFx = Effect.fn("invokeGameSaveTransportFx")(
	<Value>(operation: GameSaveStorageError["operation"], call: () => Promise<Value>) =>
		Effect.tryPromise({
			try: call,
			catch: (cause) =>
				new GameSaveStorageError({
					operation,
					cause,
				}),
		}),
);
