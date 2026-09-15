import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { readArkpackFileLayoutFx } from "~/arkpack-artifact/fx/readArkpackFileLayoutFx";
import { verifyArkpackFileProvenanceFx } from "~/arkpack-artifact/fx/verifyArkpackFileProvenanceFx";

const runArkpackVerifyFx = Effect.fn("runArkpackVerifyFx")(function* (arkpackPath: string) {
	const layout = yield* readArkpackFileLayoutFx(arkpackPath);
	const provenance = yield* verifyArkpackFileProvenanceFx(layout);
	yield* Console.log(JSON.stringify(provenance));
});

export const ArkpackVerifyCommand = Command.make(
	"verify",
	{
		arkpack: Argument.File("arkpack"),
	},
	({ arkpack }) => runArkpackVerifyFx(arkpack),
).pipe(Command.withDescription("Offline-classify one Arkpack as Official or Community."));
