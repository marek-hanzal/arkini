import { Effect } from "effect";
import { ArkpackStorageError } from "~/bridge/arkpack/ArkpackStorageError";

/** Adapts one typed preload Arkpack Promise into the renderer Effect error channel. */
export const invokeArkpackTransportFx = Effect.fn("invokeArkpackTransportFx")(
	<Value>(operation: ArkpackStorageError["operation"], call: () => Promise<Value>) =>
		Effect.tryPromise({
			try: call,
			catch: (cause) =>
				new ArkpackStorageError({
					operation,
					cause,
				}),
		}),
);
