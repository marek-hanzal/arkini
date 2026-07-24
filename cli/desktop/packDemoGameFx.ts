import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { renderGameDiagnosticsFx } from "~/engine/validation/fx/renderGameDiagnosticsFx";

export namespace packDemoGameFx {
	export interface Props {
		readonly gameDirectory?: string;
	}
}

/** Packs the deliberately unsigned bundled demo for external-trust integration testing. */
export const packDemoGameFx = Effect.fn("packDemoGameFx")(function* ({
	gameDirectory = "game/demo",
}: packDemoGameFx.Props = {}) {
	const packed = yield* packDirectoryFx({
		input: gameDirectory,
		metadata: {
			output: "game/demo.game.arkpack.metadata.json",
			packageId: "demo",
		},
	}).pipe(
		Effect.catchTag("GameValidationError", (error) =>
			renderGameDiagnosticsFx(error.diagnostics).pipe(Effect.zipRight(Effect.fail(error))),
		),
	);
	yield* renderGameDiagnosticsFx(packed.diagnostics);
	yield* Console.log(`Packed unsigned ${packed.output} for the desktop build.`);
});
