import type { Effect } from "effect";
import type { AppearanceAccent } from "~/bridge/appearance/AppearanceAccent";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";

export namespace LauncherStartup {
	export interface Appearance {
		readonly theme: AppearanceTheme;
		readonly accent: AppearanceAccent;
	}

	export interface Result {
		readonly appearance: Appearance;
		readonly builtInPackageId: string;
	}

	export type State =
		| {
				readonly type: "loading";
				readonly appearance: Appearance | null;
				readonly heroReady: boolean;
				readonly splashCompleted: boolean;
		  }
		| {
				readonly type: "ready";
				readonly appearance: Appearance;
				readonly builtInPackageId: string;
				readonly heroReady: boolean;
				readonly splashCompleted: boolean;
		  }
		| {
				readonly type: "failed";
				readonly appearance: Appearance | null;
				readonly error: unknown;
				readonly heroReady: boolean;
				readonly splashCompleted: boolean;
		  };

	export interface Props {
		readonly catalog: ArkpackCatalog;
		readonly heroUrl: string;
		readonly bootstrapFx?: Effect.Effect<Result, unknown>;
	}
}

/** One renderer-session startup owner for bootstrap, retry and splash completion. */
export interface LauncherStartup {
	readonly getSnapshot: () => LauncherStartup.State;
	readonly startFx: Effect.Effect<void, unknown>;
	readonly retryFx: Effect.Effect<void, unknown>;
	readonly completeSplashFx: Effect.Effect<void>;
	readonly subscribe: (listener: () => void | PromiseLike<void>) => () => void;
}
