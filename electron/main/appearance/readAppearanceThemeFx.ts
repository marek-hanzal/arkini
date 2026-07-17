import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { AppearanceThemeSchema } from "../../../desktop/appearance/AppearanceThemeSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace readAppearanceThemeFx {
	export interface Options {
		readonly userDataPath: string;
		readonly readFile?: typeof readFile;
	}
}

/** Reads the persisted preference, recovering missing or malformed data to Arkini's dark default. */
export const readAppearanceThemeFx = Effect.fn("readAppearanceThemeFx")(
	({ userDataPath, readFile: read = readFile }: readAppearanceThemeFx.Options) =>
		Effect.tryPromise({
			try: async () => {
				try {
					const stored = await read(
						join(userDataPath, "arkini", "preferences", "appearance.theme"),
						"utf8",
					);
					const parsed = AppearanceThemeSchema.safeParse(stored.trim());
					return parsed.success ? parsed.data : "dark";
				} catch (cause) {
					if ((cause as NodeJS.ErrnoException).code === "ENOENT") return "dark";
					throw cause;
				}
			},
			catch: (cause) =>
				new ElectronMainError({
					operation: "read the appearance preference",
					cause,
				}),
		}),
);
