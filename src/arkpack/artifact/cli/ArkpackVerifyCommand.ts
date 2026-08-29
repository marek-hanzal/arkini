import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect, FileSystem } from "effect";

import { verifyArkpackProvenanceFx } from "~/arkpack/artifact/fx/verifyArkpackProvenanceFx";

const runArkpackVerifyFx = Effect.fn("runArkpackVerifyFx")(function* (arkpackPath: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const provenance = yield* verifyArkpackProvenanceFx({
		bytes: yield* fileSystem.readFile(arkpackPath),
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
