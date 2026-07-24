import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

import { readArkpackTrustedKeysFx } from "~/engine/pack/fx/readArkpackTrustedKeysFx";
import { verifyArkpackFileFx } from "~/engine/pack/fx/verifyArkpackFileFx";
import { handleArkpackInputErrorFx } from "./handleArkpackInputErrorFx";

export namespace runArkpackVerifyFx {
	export interface Props {
		readonly arkpackPath: string;
		readonly trustedKeysPath: string;
	}
}

const runArkpackVerifyFx = Effect.fn("runArkpackVerifyFx")(function* ({
	arkpackPath,
	trustedKeysPath,
}: runArkpackVerifyFx.Props) {
	const registry = yield* readArkpackTrustedKeysFx(trustedKeysPath);
	const result = yield* verifyArkpackFileFx({
		arkpackPath,
		trustedKeys: registry,
	});
	yield* Console.log(JSON.stringify(result));
	if (result.trust.type === "invalid") {
		return yield* Effect.fail(
			new Error(`Arkpack signature is invalid: ${result.trust.reason}.`),
		);
	}
});

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
		runArkpackVerifyFx({
			arkpackPath: arkpack,
			trustedKeysPath: trustedKeys,
		}).pipe(Effect.catchAll(handleArkpackInputErrorFx)),
).pipe(
	Command.withDescription(
		"Verify one Arkpack and print its explicit official, external, or invalid trust.",
	),
);
