import { Effect } from "effect";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { AppearanceThemeError } from "~/bridge/appearance/AppearanceThemeError";

/** Persists and applies one explicit Electron appearance preference. */
export const writeAppearanceThemeFx = Effect.fn("writeAppearanceThemeFx")(
	(theme: AppearanceTheme) =>
		Effect.tryPromise({
			try: () => window.arkini.appearance.write(theme),
			catch: (cause) =>
				new AppearanceThemeError({
					operation: "write",
					cause,
				}),
		}),
);
