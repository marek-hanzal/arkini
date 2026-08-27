import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { signArkpackFileFx } from "~/engine/pack/fx/signArkpackFileFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";
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
	const result = yield* packDirectoryFx({
		input,
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
	if (process.env.ARKINI_RELEASE_SIGN === "1") {
		const signed = yield* signArkpackFileFx({
			arkpackPath: result.arkpack,
		});
		yield* Console.log(`Wrote ${signed.signaturePath}.`);
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
