import type { Effect } from "effect";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";

export namespace LauncherStartup {
	export interface Appearance {
		readonly theme: AppearanceTheme;
		readonly accent: AppearanceAccent;
	}

	export interface Result {
		readonly appearance: Appearance;
		readonly builtInPackageId: string;
		readonly cheatsAvailable: boolean;
	}

	export interface Props {
		readonly heroUrl: string;
		readonly bootstrapFx?: Effect.Effect<Result, unknown>;
	}
}
