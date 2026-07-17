import { Command } from "@effect/platform";
import { Console, Effect } from "effect";
import { verifyRendererAssetGraphFx } from "../../electron/verify/verifyRendererAssetGraphFx";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { renderGameDiagnosticsFx } from "~/engine/validation/fx/renderGameDiagnosticsFx";
import { DesktopPackagingError } from "./DesktopPackagingError";

export namespace buildDesktopFx {
	export interface Props {
		readonly gameDirectory?: string;
	}
}

export const buildDesktopFx = Effect.fn("buildDesktopFx")(function* ({
	gameDirectory = "game/arkini",
}: buildDesktopFx.Props = {}) {
	const packed = yield* packDirectoryFx({
		input: gameDirectory,
		metadata: {
			output: "game/arkini.game.arkpack.metadata.json",
			packageId: "arkini",
		},
	}).pipe(
		Effect.catchTag("GameValidationError", (error) =>
			renderGameDiagnosticsFx(error.diagnostics).pipe(Effect.zipRight(Effect.fail(error))),
		),
	);
	yield* renderGameDiagnosticsFx(packed.diagnostics);
	yield* Console.log(`Packed ${packed.output} before the Electron production build.`);
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
