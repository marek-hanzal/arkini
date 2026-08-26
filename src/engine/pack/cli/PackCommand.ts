import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";

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
		Effect.catchTag("GameValidationError", (error) =>
			printGameDiagnosticsForCliFx(error.diagnostics).pipe(
				Effect.andThen(Effect.fail(error)),
			),
		),
	);
	yield* printGameDiagnosticsForCliFx(result.diagnostics);

	yield* Console.log(`Packed ${result.json} JSON sources and ${result.png} PNG assets.`);
	yield* Console.log(`Wrote ${result.output} (${result.bytes} bytes).`);
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
