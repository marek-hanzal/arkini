import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { AppearanceThemeSchema } from "../../../desktop/appearance/AppearanceThemeSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace writeAppearanceThemeFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly theme: AppearanceThemeSchema.Type;
	}
}

/** Atomically persists one explicit dark, light, or system appearance preference. */
export const writeAppearanceThemeFx = Effect.fn("writeAppearanceThemeFx")(function* ({
	root,
	fileSystem,
	theme,
}: writeAppearanceThemeFx.Props) {
	const validTheme = yield* Effect.try({
		try: () => AppearanceThemeSchema.parse(theme),
		catch: (cause) =>
			new ElectronMainError({
				operation: "persist the appearance preference",
				cause,
			}),
	});
	const pending = join(root, "appearance.pending");
	const current = join(root, "appearance.theme");
	yield* fileSystem
		.makeDirectory(root, {
			recursive: true,
		})
		.pipe(
			Effect.zipRight(fileSystem.writeFileString(pending, validTheme)),
			Effect.zipRight(
				fileSystem.rename(pending, current).pipe(
					Effect.ensuring(
						fileSystem
							.remove(pending, {
								force: true,
							})
							.pipe(Effect.ignore),
					),
				),
			),
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "persist the appearance preference",
						cause,
					}),
			),
		);
});
