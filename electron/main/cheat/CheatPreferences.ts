import type { Effect } from "effect";
import type { CheatAvailabilitySchema } from "../../contract/cheat/CheatAvailabilitySchema";
import type { ElectronMainError } from "../ElectronMainError";

/** Effect-native main-process capability for application-wide cheat-tool availability. */
export interface CheatPreferences {
	readonly readAvailableFx: Effect.Effect<CheatAvailabilitySchema.Type, ElectronMainError>;
	readonly writeAvailableFx: (
		available: CheatAvailabilitySchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
}
