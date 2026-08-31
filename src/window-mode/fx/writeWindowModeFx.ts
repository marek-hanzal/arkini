import { Effect, Semaphore } from "effect";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";

const writeSemaphore = Semaphore.makeUnsafe(1);

/** Serializes, persists, and applies one requested native window mode through Electron. */
export const writeWindowModeFx = Effect.fn("writeWindowModeFx")((mode: WindowModeSchema.Type) =>
	writeSemaphore.withPermits(1)(
		Effect.tryPromise({
			try: () => window.arkini.window.writeMode(mode),
			catch: (cause) => cause,
		}),
	),
);
