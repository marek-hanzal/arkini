import { Effect } from "effect";
import { AppearanceThemeSchema } from "../../../electron/contract/appearance/AppearanceThemeSchema";
import { AppearanceThemeError } from "~/ui/appearance/AppearanceThemeError";

/** Reads the Electron-owned appearance preference and validates the preload boundary. */
export const readAppearanceThemeFx = Effect.fn("readAppearanceThemeFx")(() =>
	Effect.tryPromise({
		try: async () => AppearanceThemeSchema.parse(await window.arkini.appearance.read()),
		catch: (cause) =>
			new AppearanceThemeError({
				operation: "read",
				cause,
			}),
	}),
);
