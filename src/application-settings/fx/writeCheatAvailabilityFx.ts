import { Effect, Semaphore } from "effect";
import { CheatAvailabilitySchema } from "../../../electron/contract/cheat/CheatAvailabilitySchema";

const writeSemaphore = Semaphore.makeUnsafe(1);

/** Persists one application-wide cheat-tool availability value. */
export const writeCheatAvailabilityFx = Effect.fn("writeCheatAvailabilityFx")(
	(available: CheatAvailabilitySchema.Type) =>
		writeSemaphore.withPermits(1)(
			Effect.tryPromise({
				try: async () =>
					window.arkini.cheats.writeAvailable(CheatAvailabilitySchema.parse(available)),
				catch: (cause) => cause,
			}),
		),
);
