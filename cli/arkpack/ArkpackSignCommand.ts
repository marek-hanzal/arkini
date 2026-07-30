import { Argument, Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { readArkpackPrivateKeyFx } from "~/engine/pack/fx/readArkpackPrivateKeyFx";
import { signArkpackFileFx } from "~/engine/pack/fx/signArkpackFileFx";
import { handleArkpackInputErrorFx } from "./handleArkpackInputErrorFx";

namespace runArkpackSignFx {
	export interface Props {
		readonly arkpackPath: string;
		readonly keyId: string;
		readonly privateKeyPath: string;
	}
}

const runArkpackSignFx = Effect.fn("runArkpackSignFx")(function* ({
	arkpackPath,
	keyId,
	privateKeyPath,
}: runArkpackSignFx.Props) {
	const resolvedPrivateKey = yield* readArkpackPrivateKeyFx({
		privateKey: process.env.ARKINI_ARKPACK_PRIVATE_KEY,
		path: privateKeyPath,
	});
	const result = yield* signArkpackFileFx({
		arkpackPath,
		keyId,
		privateKey: resolvedPrivateKey,
	});
	yield* Console.log(`Wrote ${result.signaturePath}.`);
});

export const ArkpackSignCommand = Command.make(
	"sign",
	{
		arkpack: Argument.file("arkpack"),
		keyId: Flag.string("key-id").pipe(
			Flag.withDescription("Trusted registry key identity stored in the sidecar."),
		),
		privateKeyPath: Flag.string("private-key").pipe(
			Flag.withDefault(".arkini/arkpack-private.pem"),
			Flag.withDescription(
				"Local private PKCS8 PEM path; ARKINI_ARKPACK_PRIVATE_KEY takes precedence in CI.",
			),
		),
	},
	({ arkpack, keyId, privateKeyPath }) =>
		runArkpackSignFx({
			arkpackPath: arkpack,
			keyId,
			privateKeyPath,
		}).pipe(Effect.catch(handleArkpackInputErrorFx)),
).pipe(
	Command.withDescription("Sign exact final Arkpack bytes into the canonical detached sidecar."),
);
