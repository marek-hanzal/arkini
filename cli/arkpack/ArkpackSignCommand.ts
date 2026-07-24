import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { readArkpackPrivateKeyFx } from "~/engine/pack/fx/readArkpackPrivateKeyFx";
import { signArkpackFileFx } from "~/engine/pack/fx/signArkpackFileFx";

export const ArkpackSignCommand = Command.make(
	"sign",
	{
		arkpack: Args.file({
			name: "arkpack",
		}),
		keyId: Options.text("key-id").pipe(
			Options.withDescription("Trusted registry key identity stored in the sidecar."),
		),
		privateKey: Options.text("private-key").pipe(
			Options.withDefault(".arkini/arkpack-private.pem"),
			Options.withDescription(
				"Local private PKCS8 PEM path; ARKINI_ARKPACK_PRIVATE_KEY takes precedence in CI.",
			),
		),
	},
	({ arkpack, keyId, privateKey }) =>
		Effect.gen(function* () {
			const resolvedPrivateKey = yield* readArkpackPrivateKeyFx({
				environmentValue: process.env.ARKINI_ARKPACK_PRIVATE_KEY,
				path: privateKey,
			});
			const result = yield* signArkpackFileFx({
				arkpackPath: arkpack,
				keyId,
				privateKey: resolvedPrivateKey,
			});
			yield* Console.log(`Wrote ${result.signaturePath}.`);
			yield* Console.log(`SHA-256 ${result.signature.contentHash}.`);
		}),
).pipe(
	Command.withDescription("Sign exact final Arkpack bytes into the canonical detached sidecar."),
);
