import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { compileGameDirectoryFx } from "~/game-config-compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/game-config-compiler/fx/assertGameConfigValidFx";
import { printGameDiagnosticsForCliFx } from "~/arkini-cli/fx/printGameDiagnosticsForCliFx";

export namespace ValidateCommand {
	export interface Props {
		input: string;
	}
}

const runValidateCommandFx = Effect.fn("runValidateCommandFx")(function* ({
	input,
}: ValidateCommand.Props) {
	const result = yield* compileGameDirectoryFx({
		input,
	});
	yield* printGameDiagnosticsForCliFx(result.diagnostics);
	yield* assertGameConfigValidFx(result);
	yield* Console.log(`Validated ${input}.`);
});

/** CLI command that runs the production completed-game compiler and validators. */
export const ValidateCommand = ({ input }: ValidateCommand.Props) =>
	Command.make(
		"validate",
		{
			input: Argument.directory("input").pipe(Argument.withDefault(input)),
		},
		({ input }) =>
			runValidateCommandFx({
				input,
			}),
	).pipe(
		Command.withDescription(
			"Compile and validate one portable game-project directory without packing it.",
		),
	);
