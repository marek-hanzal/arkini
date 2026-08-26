import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { ArkiniBuiltPublicKey } from "~/engine/pack/ArkiniBuiltPublicKey";
import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { readArkpackSignKeyFx } from "~/engine/pack/fx/readArkpackSignKeyFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";
import { deriveArkpackPublicKey } from "./deriveArkpackPublicKey";
import { GameValidationError } from "~/engine/validation/error/GameValidationError";

export namespace PackCommand {
	export interface Props {
		input: string;
		name?: string;
	}
}

namespace runPackCommandFx {
	export interface Props {
		readonly input: string;
	}
}

const runPackCommandFx = Effect.fn("runPackCommandFx")(function* ({
	input,
}: runPackCommandFx.Props) {
	const candidateSignKey = process.env.ARKINI_SIGN_KEY;
	const signKey =
		candidateSignKey === undefined || candidateSignKey.trim().length === 0
			? undefined
			: yield* readArkpackSignKeyFx(candidateSignKey);
	const publicKey =
		ArkiniBuiltPublicKey ??
		(signKey === undefined ? undefined : deriveArkpackPublicKey(signKey));
	const result = yield* packDirectoryFx({
		input,
		...(publicKey === undefined || signKey === undefined
			? {}
			: {
					signing: {
						publicKey,
						signKey,
					},
				}),
	}).pipe(
		Effect.catch((error) =>
			error instanceof GameValidationError
				? printGameDiagnosticsForCliFx(error.diagnostics).pipe(
						Effect.andThen(Effect.fail(error)),
					)
				: Effect.fail(error),
		),
	);
	yield* printGameDiagnosticsForCliFx(result.diagnostics);

	yield* Console.log(`Packed ${result.json} JSON sources and ${result.png} PNG assets.`);
	yield* Console.log(`Wrote ${result.arkpack} (${result.bytes} bytes).`);
	if (result.signaturePath !== undefined) {
		yield* Console.log(`Wrote ${result.signaturePath}.`);
	}
});

/**
 * CLI command that packs one game source directory into an Arkini binary package.
 */
export const PackCommand = ({ input, name = "pack" }: PackCommand.Props) =>
	Command.make(
		name,
		{
			input: Argument.directory("input").pipe(Argument.withDefault(input)),
		},
		({ input }) =>
			runPackCommandFx({
				input,
			}),
	).pipe(
		Command.withDescription(
			"Pack one current portable game project into a compressed `.arkpack` file.",
		),
	);
