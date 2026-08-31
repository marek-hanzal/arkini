import { Effect, Semaphore } from "effect";
import type { AppearanceThemeSchema } from "~electron/contract/appearance/AppearanceThemeSchema";
import { AppearanceThemeError } from "~/application-settings/error/AppearanceThemeError";

const writeSemaphore = Semaphore.makeUnsafe(1);

/** Persists and applies one explicit Electron appearance preference. */
export const writeAppearanceThemeFx = Effect.fn("writeAppearanceThemeFx")(
	(theme: AppearanceThemeSchema.Type) =>
		writeSemaphore.withPermits(1)(
			Effect.tryPromise({
				try: () => window.arkini.appearance.writeFn(theme),
				catch: (cause) =>
					new AppearanceThemeError({
						operation: "write",
						cause,
					}),
			}),
		),
);
