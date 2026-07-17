import { Command } from "@effect/platform";
import { Effect } from "effect";
import { verifyRendererAssetGraphFx } from "../../electron/verify/verifyRendererAssetGraphFx";
import { DesktopPackagingError } from "./DesktopPackagingError";

export const buildDesktopOutputFx = Effect.fn("buildDesktopOutputFx")(function* () {
	yield* Command.make("electron-vite", "build").pipe(
		Command.stdin("inherit"),
		Command.stdout("inherit"),
		Command.stderr("inherit"),
		Command.exitCode,
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
	yield* verifyRendererAssetGraphFx();
});
