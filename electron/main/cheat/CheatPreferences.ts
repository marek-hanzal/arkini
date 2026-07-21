import type { Effect } from "effect";
import type { CheatAvailabilitySchema } from "../../../desktop/cheat/CheatAvailabilitySchema";

/** Effect-native main-process capability for application-wide cheat-tool availability. */
export interface CheatPreferences {
	readonly readAvailableFx: Effect.Effect<CheatAvailabilitySchema.Type, unknown>;
	readonly writeAvailableFx: (
		available: CheatAvailabilitySchema.Type,
	) => Effect.Effect<void, unknown>;
}
