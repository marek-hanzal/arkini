import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { AppearanceThemeSchema } from "../../../desktop/appearance/AppearanceThemeSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace writeAppearanceThemeFx {
	export interface Options {
		readonly userDataPath: string;
		readonly theme: AppearanceThemeSchema.Type;
	}
}

/** Atomically persists one explicit dark, light, or system appearance preference. */
export const writeAppearanceThemeFx = Effect.fn("writeAppearanceThemeFx")(
	({ userDataPath, theme }: writeAppearanceThemeFx.Options) =>
		Effect.tryPromise({
			try: async () => {
				const validTheme = AppearanceThemeSchema.parse(theme);
				const directory = join(userDataPath, "arkini", "preferences");
				const pending = join(directory, "appearance.pending");
				const current = join(directory, "appearance.theme");
				await mkdir(directory, {
					recursive: true,
				});
				try {
					await writeFile(pending, validTheme, "utf8");
					await rename(pending, current);
				} finally {
					await rm(pending, {
						force: true,
					});
				}
			},
			catch: (cause) =>
				new ElectronMainError({
					operation: "persist the appearance preference",
					cause,
				}),
		}),
);
