import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { verifyRendererAssetGraphFx } from "../../electron/verify/verifyRendererAssetGraphFx";
import { ProjectOutputPaths } from "../../shared/ProjectOutputPaths";
import { DesktopPackagingError } from "./DesktopPackagingError";

export const buildDesktopOutputFx = Effect.fn("buildDesktopOutputFx")(function* () {
	const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	yield* childProcessSpawner
		.exitCode(
			ChildProcess.make(
				"electron-vite",
				[
					"build",
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
						operation: "build the Electron application",
						cause,
					}),
			),
			Effect.flatMap((exitCode) =>
				exitCode === 0
					? Effect.void
					: Effect.fail(
							new DesktopPackagingError({
								operation: "build the Electron application",
								cause: new Error(`electron-vite exited with code ${exitCode}.`),
							}),
						),
			),
		);
	yield* verifyRendererAssetGraphFx(`${ProjectOutputPaths.desktop.build}/renderer`);
});
