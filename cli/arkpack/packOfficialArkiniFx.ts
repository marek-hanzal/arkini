import { Console, Effect } from "effect";
import { packSignedDirectoryFx } from "~/engine/pack/fx/packSignedDirectoryFx";
import { readArkpackPrivateKeyFx } from "~/engine/pack/fx/readArkpackPrivateKeyFx";
import { readArkpackTrustedKeysFx } from "~/engine/pack/fx/readArkpackTrustedKeysFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";
import { ArkiniOfficialArkpackSigning } from "./ArkiniOfficialArkpackSigning";

export namespace packOfficialArkiniFx {
	export interface Props {
		readonly gameDirectory?: string;
	}
}

export const packOfficialArkiniFx = Effect.fn("packOfficialArkiniFx")(function* ({
	gameDirectory = "game/arkini",
}: packOfficialArkiniFx.Props = {}) {
	const privateKey = yield* readArkpackPrivateKeyFx({
		privateKey: process.env.ARKINI_ARKPACK_PRIVATE_KEY,
		path: ArkiniOfficialArkpackSigning.privateKeyPath,
	});
	const trustedKeys = yield* readArkpackTrustedKeysFx(
		ArkiniOfficialArkpackSigning.trustedKeysPath,
	);
	const result = yield* packSignedDirectoryFx({
		input: gameDirectory,
		keyId: ArkiniOfficialArkpackSigning.keyId,
		packageId: ArkiniOfficialArkpackSigning.packageId,
		version: ArkiniOfficialArkpackSigning.version,
		output: "game/arkini.game.arkpack",
		privateKey,
		trustedKeys,
	});
	yield* printGameDiagnosticsForCliFx(result.packed.diagnostics);
	yield* Console.log(
		`Packed, signed, and verified ${result.packed.output} with ${ArkiniOfficialArkpackSigning.keyId}.`,
	);
});
