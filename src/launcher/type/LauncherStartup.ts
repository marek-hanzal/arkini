import type { Effect } from "effect";
import type { AppearanceAccentSchema } from "~electron/contract/appearance/AppearanceAccentSchema";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import type { SoundSettings } from "~electron/contract/sound/SoundSettings";

export namespace LauncherStartup {
	export interface Result {
		readonly accent: AppearanceAccentSchema.Type;
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
