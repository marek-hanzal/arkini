import { Command, FileSystem } from "@effect/platform";
import { join, resolve } from "node:path";
import { Effect } from "effect";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace createUnpackedMacAppFx {
	export interface Props {
		readonly arch: "arm64";
		readonly outputDirectory?: string;
	}
}

export const createUnpackedMacAppFx = Effect.fn("createUnpackedMacAppFx")(function* ({
	arch,
	outputDirectory = "release",
}: createUnpackedMacAppFx.Props) {
	yield* Command.make(
		"electron-builder",
		"--config",
		"electron-builder.yml",
		"--mac",
		`--${arch}`,
		"--dir",
		"--publish",
		"never",
	).pipe(
		Command.stdin("inherit"),
		Command.stdout("inherit"),
		Command.stderr("inherit"),
		Command.exitCode,
		Effect.mapError(
			(cause) =>
				new DesktopPackagingError({
					operation: `create the unpacked macOS ${arch} application`,
					cause,
				}),
		),
		Effect.flatMap((exitCode) =>
			exitCode === 0
				? Effect.void
				: Effect.fail(
						new DesktopPackagingError({
							operation: `create the unpacked macOS ${arch} application`,
							cause: new Error(`electron-builder exited with code ${exitCode}.`),
						}),
					),
		),
	);

	const appPath = resolve(outputDirectory, "mac-arm64", "Arkini.app");
	const fileSystem = yield* FileSystem.FileSystem;
	yield* fileSystem.access(join(appPath, "Contents", "Resources", "app.asar")).pipe(
		Effect.mapError(
			(cause) =>
				new DesktopPackagingError({
					operation: "verify the unpacked macOS application",
					cause,
				}),
		),
	);
	return appPath;
});
