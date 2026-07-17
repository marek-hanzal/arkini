import { Console, Effect } from "effect";
import { verifyRendererAssetGraphFx } from "../../electron/verify/verifyRendererAssetGraphFx";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { renderGameDiagnosticsFx } from "~/engine/validation/fx/renderGameDiagnosticsFx";
import { runDesktopCommandFx } from "./runDesktopCommandFx";

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
	yield* runDesktopCommandFx({
		command: "electron-vite",
		args: [
			"build",
		],
		operation: "build the Electron application",
	});
	yield* verifyRendererAssetGraphFx();
});
