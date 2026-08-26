import { Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { writeArkpackSignKeyFx } from "~/engine/pack/fx/writeArkpackSignKeyFx";
import { handleArkpackInputErrorFx } from "./handleArkpackInputErrorFx";

const runArkpackKeygenFx = Effect.fn("runArkpackKeygenFx")(function* ({
	force,
	output,
}: {
	readonly force: boolean;
	readonly output: string;
}) {
	const result = yield* writeArkpackSignKeyFx({
		force,
		output,
	});
	yield* Console.log(`Wrote protected ARKINI_SIGN_KEY input to ${result.output}.`);
});

export const ArkpackKeygenCommand = Command.make(
	"keygen",
	{
		force: Flag.boolean("force").pipe(
			Flag.withDefault(false),
			Flag.withDescription("Allow replacing the exact requested dotenv output."),
		),
		output: Flag.string("output").pipe(
			Flag.withDefault(".env.local"),
			Flag.withDescription("Protected dotenv destination for ARKINI_SIGN_KEY."),
		),
	},
	({ force, output }) =>
		runArkpackKeygenFx({
			force,
			output,
		}).pipe(Effect.catch(handleArkpackInputErrorFx)),
).pipe(
	Command.withDescription("Generate one Ed25519 signing key without printing private material."),
);
