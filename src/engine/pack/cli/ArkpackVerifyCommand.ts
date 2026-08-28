import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { verifyArkpackFileFx } from "~/engine/pack/fx/verifyArkpackFileFx";

const runArkpackVerifyFx = Effect.fn("runArkpackVerifyFx")(function* (arkpackPath: string) {
	const provenance = yield* verifyArkpackFileFx({
		arkpackPath,
	});
	yield* Console.log(JSON.stringify(provenance));
});

export const ArkpackVerifyCommand = Command.make(
	"verify",
	{
		arkpack: Argument.file("arkpack"),
	},
	({ arkpack }) => runArkpackVerifyFx(arkpack),
).pipe(Command.withDescription("Offline-classify one Arkpack as Official or Community."));
