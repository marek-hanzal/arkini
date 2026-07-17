import { Command } from "@effect/platform";
import { Effect } from "effect";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace openMacAppFx {
	export interface Props {
		readonly appPath: string;
	}
}

export const openMacAppFx = Effect.fn("openMacAppFx")(({ appPath }: openMacAppFx.Props) => {
	if (process.platform !== "darwin") {
		return Effect.fail(
			new DesktopPackagingError({
				operation: "launch the unpacked macOS application",
				cause: new Error("The macOS preview command can only run on macOS."),
			}),
		);
	}

	return Command.make("open", appPath).pipe(
		Command.stdin("inherit"),
		Command.stdout("inherit"),
		Command.stderr("inherit"),
		Command.exitCode,
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
