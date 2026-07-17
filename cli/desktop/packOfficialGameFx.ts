import { Console, Effect } from "effect";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { renderGameDiagnosticsFx } from "~/engine/validation/fx/renderGameDiagnosticsFx";

export namespace packOfficialGameFx {
	export interface Props {
		readonly gameDirectory?: string;
	}
}

export const packOfficialGameFx = Effect.fn("packOfficialGameFx")(function* ({
	gameDirectory = "game/arkini",
}: packOfficialGameFx.Props = {}) {
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
	yield* Console.log(`Packed ${packed.output} for the desktop build.`);
});
