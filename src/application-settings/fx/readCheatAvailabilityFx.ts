import { Effect } from "effect";
import { CheatAvailabilitySchema } from "~electron/contract/cheat/CheatAvailabilitySchema";

/** Reads the application-wide preference that exposes save-scoped cheat tooling. */
export const readCheatAvailabilityFx = Effect.fn("readCheatAvailabilityFx")(() =>
	Effect.tryPromise({
		try: async () =>
			CheatAvailabilitySchema.parse(await window.arkini.cheats.readAvailableFn()),
		catch: (cause) => cause,
	}),
);
