import { Command } from "@effect/platform";
import { Effect } from "effect";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace packageDesktopMacArtifactsFx {
	export interface Props {
		readonly arch: "arm64";
	}
}

export const packageDesktopMacArtifactsFx = Effect.fn("packageDesktopMacArtifactsFx")(
	({ arch }: packageDesktopMacArtifactsFx.Props) =>
		Command.make(
			"electron-builder",
			"--config",
			"electron-builder.yml",
			"--mac",
			`--${arch}`,
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
		),
);
