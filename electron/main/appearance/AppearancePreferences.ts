import type { Effect } from "effect";
import type { AppearanceAccentSchema } from "../../contract/appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "../../contract/appearance/AppearanceThemeSchema";
import type { ElectronMainError } from "../ElectronMainError";

/** Effect-native main-process capability for Arkini appearance preferences. */
export interface AppearancePreferences {
	readonly readThemeFx: Effect.Effect<AppearanceThemeSchema.Type, ElectronMainError>;
	readonly writeThemeFx: (
		theme: AppearanceThemeSchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
	readonly readAccentFx: Effect.Effect<AppearanceAccentSchema.Type, ElectronMainError>;
	readonly writeAccentFx: (
		accent: AppearanceAccentSchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
}
