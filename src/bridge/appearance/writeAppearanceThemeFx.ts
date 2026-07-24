import { Effect, Semaphore } from "effect";
import type { AppearanceTheme } from "~/bridge/appearance/AppearanceTheme";
import { AppearanceThemeError } from "~/bridge/appearance/AppearanceThemeError";

const writeSemaphore = Semaphore.makeUnsafe(1);

/** Persists and applies one explicit Electron appearance preference. */
export const writeAppearanceThemeFx = Effect.fn("writeAppearanceThemeFx")(
	(theme: AppearanceTheme) =>
		writeSemaphore.withPermits(1)(
			Effect.tryPromise({
				try: () => window.arkini.appearance.write(theme),
				catch: (cause) =>
					new AppearanceThemeError({
						operation: "write",
						cause,
					}),
			}),
		),
);
