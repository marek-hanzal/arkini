import { Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { join, resolve } from "node:path";
import { ProjectOutputPaths } from "../../shared/ProjectOutputPaths";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace createUnpackedMacAppFx {
	export interface Props {
		readonly arch: "arm64";
		readonly outputDirectory?: string;
	}
}

export const createUnpackedMacAppFx = Effect.fn("createUnpackedMacAppFx")(function* ({
	arch,
	outputDirectory = ProjectOutputPaths.desktop.release,
}: createUnpackedMacAppFx.Props) {
	const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	yield* childProcessSpawner
		.exitCode(
			ChildProcess.make(
				"electron-builder",
				[
					"--config",
					"electron-builder.yml",
					"--mac",
					`--${arch}`,
					"--dir",
					"--config.directories.output",
					outputDirectory,
					"--publish",
					"never",
				],
				{
					stdin: "inherit",
					stdout: "inherit",
					stderr: "inherit",
				},
			),
		)
		.pipe(
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
