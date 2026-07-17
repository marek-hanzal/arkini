import { Command } from "@effect/platform";
import { Effect } from "effect";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace runDesktopCommandFx {
	export interface Props {
		readonly command: string;
		readonly args?: ReadonlyArray<string>;
		readonly operation: string;
	}
}

export const runDesktopCommandFx = Effect.fn("runDesktopCommandFx")(
	({ command, args = [], operation }: runDesktopCommandFx.Props) =>
		Command.make(command, ...args).pipe(
			Command.stdin("inherit"),
			Command.stdout("inherit"),
			Command.stderr("inherit"),
			Command.exitCode,
			Effect.mapError(
				(cause) =>
					new DesktopPackagingError({
						operation,
						cause,
					}),
			),
			Effect.flatMap((exitCode) =>
				exitCode === 0
					? Effect.void
					: Effect.fail(
							new DesktopPackagingError({
								operation,
								cause: new Error(`${command} exited with code ${exitCode}.`),
							}),
						),
			),
		),
);
