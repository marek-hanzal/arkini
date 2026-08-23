import type { Effect } from "effect";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import type { WindowMode } from "~/bridge/window/WindowMode";

export namespace LauncherStartup {
	export interface Appearance {
		readonly theme: AppearanceTheme;
		readonly accent: AppearanceAccent;
	}

	export interface Result {
		readonly appearance: Appearance;
		readonly defaultPackageId: string;
		readonly cheatsAvailable: boolean;
		readonly windowMode: WindowMode;
	}

	export interface Props {
		readonly heroUrl: string;
		readonly bootstrapFx?: Effect.Effect<Result, unknown>;
	}
}
