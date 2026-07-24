import { Console, Effect } from "effect";
import { packSignedDirectoryFx } from "~/engine/pack/fx/packSignedDirectoryFx";
import { readArkpackPrivateKeyFx } from "~/engine/pack/fx/readArkpackPrivateKeyFx";
import { readArkpackTrustedKeysFx } from "~/engine/pack/fx/readArkpackTrustedKeysFx";
import { renderGameDiagnosticsFx } from "~/engine/validation/fx/renderGameDiagnosticsFx";

const keyId = "arkini-official-2026-01";

export namespace packOfficialGameFx {
	export interface Props {
		readonly gameDirectory?: string;
	}
}

export const packOfficialGameFx = Effect.fn("packOfficialGameFx")(function* ({
	gameDirectory = "game/arkini",
}: packOfficialGameFx.Props = {}) {
	const privateKey = yield* readArkpackPrivateKeyFx({
		environmentValue: process.env.ARKINI_ARKPACK_PRIVATE_KEY,
		path: ".arkini/arkpack-private.pem",
	});
	const trustedKeys = yield* readArkpackTrustedKeysFx("game/arkini.arkpack.keys.json");
	const result = yield* packSignedDirectoryFx({
		input: gameDirectory,
		keyId,
		metadata: {
			output: "game/arkini.game.arkpack.metadata.json",
			packageId: "arkini",
		},
		privateKey,
		trustedKeys,
	});
	yield* renderGameDiagnosticsFx(result.packed.diagnostics);
	yield* Console.log(
		`Packed, signed, and verified ${result.packed.output} for the desktop build.`,
	);
});
