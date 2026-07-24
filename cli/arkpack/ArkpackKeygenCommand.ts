import { Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { writeArkpackKeyPairFx } from "~/engine/pack/fx/writeArkpackKeyPairFx";
import { handleArkpackInputErrorFx } from "./handleArkpackInputErrorFx";

namespace runArkpackKeygenFx {
	export interface Props {
		readonly force: boolean;
		readonly privateKeyOutput: string;
		readonly publicKeyOutput: string;
	}
}

const runArkpackKeygenFx = Effect.fn("runArkpackKeygenFx")(function* ({
	force,
	privateKeyOutput,
	publicKeyOutput,
}: runArkpackKeygenFx.Props) {
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
});

export const ArkpackKeygenCommand = Command.make(
	"keygen",
	{
		force: Flag.boolean("force").pipe(
			Flag.withDescription("Allow replacing the exact requested key outputs."),
		),
		privateKeyOutput: Flag.string("private-key-output").pipe(
			Flag.withDefault(".arkini/arkpack-private.pem"),
			Flag.withDescription("Destination for the private PKCS8 PEM."),
		),
		publicKeyOutput: Flag.string("public-key-output").pipe(
			Flag.withDefault(".arkini/arkpack-public.pem"),
			Flag.withDescription("Destination for the public SPKI PEM."),
		),
	},
	({ force, privateKeyOutput, publicKeyOutput }) =>
		runArkpackKeygenFx({
			force,
			privateKeyOutput,
			publicKeyOutput,
		}).pipe(Effect.catch(handleArkpackInputErrorFx)),
).pipe(
	Command.withDescription(
		"Generate an Ed25519 PKCS8/SPKI key pair without printing private material.",
	),
);
