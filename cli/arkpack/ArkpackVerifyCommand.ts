import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { readArkpackTrustedKeysFx } from "~/engine/pack/fx/readArkpackTrustedKeysFx";
import { verifyArkpackFileFx } from "~/engine/pack/fx/verifyArkpackFileFx";

export const ArkpackVerifyCommand = Command.make(
	"verify",
	{
		arkpack: Args.file({
			name: "arkpack",
		}),
		trustedKeys: Options.text("trusted-keys").pipe(
			Options.withDefault("game/arkini.arkpack.keys.json"),
			Options.withDescription("Explicit trusted-public-key registry JSON path."),
		),
	},
	({ arkpack, trustedKeys }) =>
		Effect.gen(function* () {
			const registry = yield* readArkpackTrustedKeysFx(trustedKeys);
			const result = yield* verifyArkpackFileFx({
				arkpackPath: arkpack,
				trustedKeys: registry,
			});
			yield* Console.log(JSON.stringify(result));
			if (result.trust.type === "invalid") {
				return yield* Effect.fail(
					new Error(`Arkpack signature is invalid: ${result.trust.reason}.`),
				);
			}
		}),
).pipe(
	Command.withDescription(
		"Verify one Arkpack and print its explicit official, external, or invalid trust.",
	),
);
