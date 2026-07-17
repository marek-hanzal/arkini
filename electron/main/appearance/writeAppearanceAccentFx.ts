import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { AppearanceAccentSchema } from "../../../desktop/appearance/AppearanceAccentSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace writeAppearanceAccentFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly accent: AppearanceAccentSchema.Type;
	}
}

/** Atomically persists one explicit Arkini accent palette. */
export const writeAppearanceAccentFx = Effect.fn("writeAppearanceAccentFx")(function* ({
	root,
	fileSystem,
	accent,
}: writeAppearanceAccentFx.Props) {
	const validAccent = yield* Effect.try({
		try: () => AppearanceAccentSchema.parse(accent),
		catch: (cause) =>
			new ElectronMainError({
				operation: "persist the appearance accent preference",
				cause,
			}),
	});
	const pending = join(root, "appearance-accent.pending");
	const current = join(root, "appearance.accent");
	yield* fileSystem
		.makeDirectory(root, {
			recursive: true,
		})
		.pipe(
			Effect.zipRight(fileSystem.writeFileString(pending, validAccent)),
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
						operation: "persist the appearance accent preference",
						cause,
					}),
			),
		);
});
