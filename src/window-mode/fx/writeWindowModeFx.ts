import { Effect, Semaphore } from "effect";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";

const writeSemaphore = Semaphore.makeUnsafe(1);

/** Serializes preference writes through Electron; native mode application is best effort. */
export const writeWindowModeFx = Effect.fn("writeWindowModeFx")((mode: WindowModeSchema.Type) =>
	writeSemaphore.withPermits(1)(
		Effect.tryPromise({
			try: () => window.serakki.window.writeModeFn(mode),
			catch: (cause) => cause,
		}),
	),
);
