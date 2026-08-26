import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { readArkpackSignKeyFx } from "~/engine/pack/fx/readArkpackSignKeyFx";
import { signArkpackFileFx } from "~/engine/pack/fx/signArkpackFileFx";
import { handleArkpackInputErrorFx } from "./handleArkpackInputErrorFx";

const runArkpackSignFx = Effect.fn("runArkpackSignFx")(function* (arkpackPath: string) {
	const signKey = yield* readArkpackSignKeyFx(process.env.ARKINI_SIGN_KEY);
	const result = yield* signArkpackFileFx({
		arkpackPath,
		signKey,
	});
	yield* Console.log(`Wrote ${result.signaturePath}.`);
});

export const ArkpackSignCommand = Command.make(
	"sign",
	{
		arkpack: Argument.file("arkpack"),
	},
	({ arkpack }) => runArkpackSignFx(arkpack).pipe(Effect.catch(handleArkpackInputErrorFx)),
).pipe(
	Command.withDescription(
		"Sign exact final Arkpack bytes with ARKINI_SIGN_KEY into the detached sidecar.",
	),
);
