import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";

export namespace PackCommand {
	export interface Props {
		input: string;
		name?: string;
		packageId: string;
	}
}

namespace runPackCommandFx {
	export interface Props {
		readonly input: string;
		readonly packageId: string;
	}
}

const runPackCommandFx = Effect.fn("runPackCommandFx")(function* ({
	input,
	packageId,
}: runPackCommandFx.Props) {
	const result = yield* packDirectoryFx({
		input,
		packageId,
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
export const PackCommand = ({ input, name = "pack", packageId }: PackCommand.Props) =>
	Command.make(
		name,
		{
			input: Argument.directory("input").pipe(Argument.withDefault(input)),
		},
		({ input }) =>
			runPackCommandFx({
				input,
				packageId,
			}),
	).pipe(
		Command.withDescription(
			"Pack JSON game sources and PNG assets into a compressed `.arkpack` file.",
		),
	);
