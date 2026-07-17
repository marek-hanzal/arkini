import { Effect } from "effect";
import { AppearanceAccentSchema } from "../../../desktop/appearance/AppearanceAccentSchema";
import { AppearanceAccentError } from "~/bridge/appearance/AppearanceAccentError";

/** Persists one validated accent palette through the trusted Electron preload boundary. */
export const writeAppearanceAccentFx = Effect.fn("writeAppearanceAccentFx")(
	(accent: AppearanceAccentSchema.Type) =>
		Effect.tryPromise({
			try: async () => window.arkini.appearance.writeAccent(accent),
			catch: (cause) =>
				new AppearanceAccentError({
					operation: "write",
					cause,
				}),
		}),
);
