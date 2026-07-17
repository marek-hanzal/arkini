import type { Effect } from "effect";
import type { AppearanceAccentSchema } from "../../../desktop/appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "../../../desktop/appearance/AppearanceThemeSchema";

/** Effect-native main-process capability for Arkini appearance preferences. */
export interface AppearancePreferences {
	readonly readThemeFx: Effect.Effect<AppearanceThemeSchema.Type, unknown>;
	readonly writeThemeFx: (theme: AppearanceThemeSchema.Type) => Effect.Effect<void, unknown>;
	readonly readAccentFx: Effect.Effect<AppearanceAccentSchema.Type, unknown>;
	readonly writeAccentFx: (accent: AppearanceAccentSchema.Type) => Effect.Effect<void, unknown>;
}
