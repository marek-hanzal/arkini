import { Argument, Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { compileGameDirectoryFx } from "~/game-config-compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/game-config-compiler/fx/assertGameConfigValidFx";
import { printGameDiagnosticsForCliFx } from "~/serakki-cli/fx/printGameDiagnosticsForCliFx";

export namespace ValidateCommand {
	export interface Props {
		input: string;
	}
}

const runValidateCommandFx = Effect.fn("runValidateCommandFx")(function* ({
	input,
	silent,
}: ValidateCommand.Props & {
	readonly silent: boolean;
}) {
	const result = yield* compileGameDirectoryFx({
		input,
	});
	yield* printGameDiagnosticsForCliFx({
		diagnostics: result.diagnostics,
		silent,
	});
	yield* assertGameConfigValidFx(result);
	yield* Console.log(`Validated ${input}.`);
});

/** CLI command that runs the production completed-game compiler and validators. */
export const ValidateCommand = ({ input }: ValidateCommand.Props) =>
	Command.make(
		"validate",
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
			runValidateCommandFx({
				input,
				silent,
			}),
	).pipe(
		Command.withDescription(
			"Compile and validate one portable game-project directory without packing it.",
		),
	);
