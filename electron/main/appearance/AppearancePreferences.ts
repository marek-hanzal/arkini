import type { Effect } from "effect";
import type { AppearanceThemeSchema } from "../../../desktop/appearance/AppearanceThemeSchema";

/** Effect-native main-process capability for one persisted appearance preference. */
export interface AppearancePreferences {
	readonly readFx: Effect.Effect<AppearanceThemeSchema.Type, unknown>;
	readonly writeFx: (theme: AppearanceThemeSchema.Type) => Effect.Effect<void, unknown>;
}
