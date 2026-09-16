import type { Effect } from "effect";
import type { AppearanceAccentSchema } from "~electron/contract/appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "~electron/contract/appearance/AppearanceThemeSchema";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import type { SoundSettings } from "~electron/contract/sound/SoundSettings";

export namespace LauncherStartup {
	export interface Appearance {
		readonly theme: AppearanceThemeSchema.Type;
		readonly accent: AppearanceAccentSchema.Type;
	}

	export interface Result {
		readonly appearance: Appearance;
		readonly defaultPackageId: string;
		readonly cheatsAvailable: boolean;
		readonly sound: SoundSettings;
		readonly windowMode: WindowModeSchema.Type;
	}

	export interface Props {
		readonly heroUrl: string;
		readonly bootstrapFx?: Effect.Effect<Result, unknown, never>;
	}
}
