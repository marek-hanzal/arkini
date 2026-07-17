import { Effect } from "effect";
import { AppearanceAccentSchema } from "../../../desktop/appearance/AppearanceAccentSchema";
import { AppearanceAccentError } from "~/bridge/appearance/AppearanceAccentError";

/** Reads the Electron-owned accent preference and validates the preload boundary. */
export const readAppearanceAccentFx = Effect.fn("readAppearanceAccentFx")(() =>
	Effect.tryPromise({
		try: async () => AppearanceAccentSchema.parse(await window.arkini.appearance.readAccent()),
		catch: (cause) =>
			new AppearanceAccentError({
				operation: "read",
				cause,
			}),
	}),
);
