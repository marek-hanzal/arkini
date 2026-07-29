import type { Effect } from "effect";
import type { WindowModeSchema } from "../../contract/window/WindowModeSchema";

/** Effect-native main-process capability for the global native window mode. */
export interface WindowPreferences {
	readonly readModeFx: Effect.Effect<WindowModeSchema.Type, unknown>;
	readonly writeModeFx: (mode: WindowModeSchema.Type) => Effect.Effect<void, unknown>;
}
