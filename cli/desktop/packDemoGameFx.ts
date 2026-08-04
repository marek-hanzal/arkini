import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";

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
			printGameDiagnosticsForCliFx(error.diagnostics).pipe(
				Effect.andThen(Effect.fail(error)),
			),
		),
	);
	yield* printGameDiagnosticsForCliFx(packed.diagnostics);
	yield* Console.log(`Packed unsigned ${packed.output} for the desktop build.`);
});
