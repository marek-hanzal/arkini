import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { ProjectOutputPaths } from "../../shared/ProjectOutputPaths";
import { DesktopPackagingError } from "./DesktopPackagingError";

export const runBuiltArkiniCliFx = Effect.fn("runBuiltArkiniCliFx")(function* (
	args: ReadonlyArray<string>,
) {
	const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const cliPath = `${ProjectOutputPaths.desktop.build}/main/cli/arkini.js`;
	const exitCode = yield* childProcessSpawner
		.exitCode(
			ChildProcess.make(
				process.execPath,
				[
					cliPath,
					...args,
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
						operation: "run the built Arkini CLI",
						cause,
					}),
			),
		);

	if (exitCode !== 0) {
		return yield* new DesktopPackagingError({
			operation: "run the built Arkini CLI",
			cause: new Error(`arkini-cli exited with code ${exitCode}.`),
		});
	}
});
