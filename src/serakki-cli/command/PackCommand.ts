import { Argument, Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/serapack-artifact/fx/packDirectoryFx";
import { signSerapackFileFx } from "~/serapack-artifact/fx/signSerapackFileFx";
import { printGameDiagnosticsForCliFx } from "~/serakki-cli/fx/printGameDiagnosticsForCliFx";
import { GameValidationError } from "~/game-config-diagnostic/error/GameValidationError";

export namespace PackCommand {
	export interface Props {
		input: string;
		name?: string;
	}
}

namespace runPackCommandFx {
	export interface Props {
		readonly input: string;
		readonly silent: boolean;
	}
}

const runPackCommandFx = Effect.fn("runPackCommandFx")(function* ({
	input,
	silent,
}: runPackCommandFx.Props) {
	const result = yield* packDirectoryFx({
		input,
	}).pipe(
		Effect.catch((error) =>
			error instanceof GameValidationError
				? printGameDiagnosticsForCliFx({
						diagnostics: error.diagnostics,
						silent,
					}).pipe(Effect.andThen(Effect.fail(error)))
				: Effect.fail(error),
		),
	);
	yield* printGameDiagnosticsForCliFx({
		diagnostics: result.diagnostics,
		silent,
	});

	yield* Console.log(`Building Serapack v${result.version}.`);
	yield* Console.log(`Packed ${result.json} JSON sources and ${result.resources} resources.`);
	yield* Console.log(`Wrote ${result.serapack} (${result.bytes} bytes).`);
	if (process.env.SERAKKI_RELEASE_SIGN === "1") {
		const signedBytes = yield* signSerapackFileFx({
			serapackPath: result.serapack,
		});
		yield* Console.log(`Embedded release proof in ${result.serapack} (${signedBytes} bytes).`);
	}
});

/**
 * CLI command that packs one game source directory into an Serakki binary package.
 */
export const PackCommand = ({ input, name = "pack" }: PackCommand.Props) =>
	Command.make(
		name,
		{
			input: Argument.Directory("input").pipe(Argument.withDefault(input)),
			silent: Flag.Boolean("silent").pipe(
				Flag.withDefault(false),
				Flag.withDescription(
					"Suppress warning diagnostics; errors and command results are still printed.",
				),
			),
		},
		({ input, silent }) =>
			runPackCommandFx({
				input,
				silent,
			}),
	).pipe(Command.withDescription("Pack one portable game project into an `.serapack` file."));
