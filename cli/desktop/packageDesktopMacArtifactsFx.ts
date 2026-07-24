import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace packageDesktopMacArtifactsFx {
	export interface Props {
		readonly arch: "arm64";
	}
}

export const packageDesktopMacArtifactsFx = Effect.fn("packageDesktopMacArtifactsFx")(function* ({
	arch,
}: packageDesktopMacArtifactsFx.Props) {
	const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* childProcessSpawner
		.exitCode(
			ChildProcess.make(
				"electron-builder",
				[
					"--config",
					"electron-builder.yml",
					"--mac",
					`--${arch}`,
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
						operation: `package the unsigned macOS ${arch} application`,
						cause,
					}),
			),
			Effect.flatMap((exitCode) =>
				exitCode === 0
					? Effect.void
					: Effect.fail(
							new DesktopPackagingError({
								operation: `package the unsigned macOS ${arch} application`,
								cause: new Error(`electron-builder exited with code ${exitCode}.`),
							}),
						),
			),
		);
});
