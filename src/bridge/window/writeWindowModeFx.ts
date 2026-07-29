import { Effect, Semaphore } from "effect";
import type { WindowMode } from "~/bridge/window/WindowMode";

const writeSemaphore = Semaphore.makeUnsafe(1);

/** Persists and applies one requested native window mode through Electron. */
export const writeWindowModeFx = Effect.fn("writeWindowModeFx")((mode: WindowMode) =>
	writeSemaphore.withPermits(1)(
		Effect.tryPromise({
			try: () => window.arkini.window.writeMode(mode),
			catch: (cause) => cause,
		}),
	),
);
