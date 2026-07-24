import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { readArkpackPrivateKeyFx } from "~/engine/pack/fx/readArkpackPrivateKeyFx";
import { signArkpackFileFx } from "~/engine/pack/fx/signArkpackFileFx";
import { handleArkpackInputErrorFx } from "./handleArkpackInputErrorFx";

export namespace runArkpackSignFx {
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
	yield* Console.log(`SHA-256 ${result.signature.contentHash}.`);
});

export const ArkpackSignCommand = Command.make(
	"sign",
	{
		arkpack: Args.file({
			name: "arkpack",
		}),
		keyId: Options.text("key-id").pipe(
			Options.withDescription("Trusted registry key identity stored in the sidecar."),
		),
		privateKeyPath: Options.text("private-key").pipe(
			Options.withDefault(".arkini/arkpack-private.pem"),
			Options.withDescription(
				"Local private PKCS8 PEM path; ARKINI_ARKPACK_PRIVATE_KEY takes precedence in CI.",
			),
		),
	},
	({ arkpack, keyId, privateKeyPath }) =>
		runArkpackSignFx({
			arkpackPath: arkpack,
			keyId,
			privateKeyPath,
		}).pipe(Effect.catchAll(handleArkpackInputErrorFx)),
).pipe(
	Command.withDescription("Sign exact final Arkpack bytes into the canonical detached sidecar."),
);
