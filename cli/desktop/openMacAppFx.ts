import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace openMacAppFx {
	export interface Props {
		readonly appPath: string;
	}
}

export const openMacAppFx = Effect.fn("openMacAppFx")(function* ({ appPath }: openMacAppFx.Props) {
	if (process.platform !== "darwin") {
		return yield* Effect.fail(
			new DesktopPackagingError({
				operation: "launch the unpacked macOS application",
				cause: new Error("The macOS preview command can only run on macOS."),
			}),
		);
	}

	const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* childProcessSpawner
		.exitCode(
			ChildProcess.make(
				"open",
				[
					appPath,
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
						operation: "launch the unpacked macOS application",
						cause,
					}),
			),
			Effect.flatMap((exitCode) =>
				exitCode === 0
					? Effect.void
					: Effect.fail(
							new DesktopPackagingError({
								operation: "launch the unpacked macOS application",
								cause: new Error(`open exited with code ${exitCode}.`),
							}),
						),
			),
		);
});
