import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import { verifySerapackFileProvenanceFx } from "~/serapack-artifact/fx/verifySerapackFileProvenanceFx";

const runSerapackVerifyFx = Effect.fn("runSerapackVerifyFx")(function* (serapackPath: string) {
	const layout = yield* readSerapackFileLayoutFx(serapackPath);
	const provenance = yield* verifySerapackFileProvenanceFx(layout);
	yield* Console.log(JSON.stringify(provenance));
});

export const SerapackVerifyCommand = Command.make(
	"verify",
	{
		serapack: Argument.File("serapack"),
	},
	({ serapack }) => runSerapackVerifyFx(serapack),
).pipe(Command.withDescription("Offline-classify one Serapack as Official or Community."));
