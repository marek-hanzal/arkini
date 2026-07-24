import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { writeArkpackKeyPairFx } from "~/engine/pack/fx/writeArkpackKeyPairFx";

export const ArkpackKeygenCommand = Command.make(
	"keygen",
	{
		force: Options.boolean("force").pipe(
			Options.withDescription("Allow replacing the exact requested key outputs."),
		),
		privateKeyOutput: Options.text("private-key-output").pipe(
			Options.withDefault(".arkini/arkpack-private.pem"),
			Options.withDescription("Destination for the private PKCS8 PEM."),
		),
		publicKeyOutput: Options.text("public-key-output").pipe(
			Options.withDefault(".arkini/arkpack-public.pem"),
			Options.withDescription("Destination for the public SPKI PEM."),
		),
	},
	({ force, privateKeyOutput, publicKeyOutput }) =>
		Effect.gen(function* () {
			const result = yield* writeArkpackKeyPairFx({
				force,
				privateKeyOutput,
				publicKeyOutput,
			});
			yield* Console.log(`Wrote private PKCS8 key to ${result.privateKeyOutput}.`);
			yield* Console.log(`Wrote public SPKI key to ${result.publicKeyOutput}.`);
			yield* Console.log(
				"Keep the private PEM only in ignored .arkini storage or a protected CI secret.",
			);
		}),
).pipe(
	Command.withDescription(
		"Generate an Ed25519 PKCS8/SPKI key pair without printing private material.",
	),
);
