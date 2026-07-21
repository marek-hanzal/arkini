import { Effect } from "effect";
import { CheatAvailabilitySchema } from "../../../desktop/cheat/CheatAvailabilitySchema";

/** Persists one application-wide cheat-tool availability value. */
export const writeCheatAvailabilityFx = Effect.fn("writeCheatAvailabilityFx")(
	(available: CheatAvailabilitySchema.Type) =>
		Effect.tryPromise({
			try: async () =>
				window.arkini.cheats.writeAvailable(CheatAvailabilitySchema.parse(available)),
			catch: (cause) => cause,
		}),
);
