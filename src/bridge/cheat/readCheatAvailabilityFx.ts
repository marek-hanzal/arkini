import { Effect } from "effect";
import { CheatAvailabilitySchema } from "../../../desktop/cheat/CheatAvailabilitySchema";

/** Reads the application-wide preference that exposes save-scoped cheat tooling. */
export const readCheatAvailabilityFx = Effect.fn("readCheatAvailabilityFx")(() =>
	Effect.tryPromise({
		try: async () => CheatAvailabilitySchema.parse(await window.arkini.cheats.readAvailable()),
		catch: (cause) => cause,
	}),
);
