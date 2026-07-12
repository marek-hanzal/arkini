import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";

import { compileGameDirectoryFx } from "~/v1/compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/v1/validation/fx/assertGameConfigValidFx";
import { renderGameDiagnosticsFx } from "~/v1/validation/fx/renderGameDiagnosticsFx";

export namespace ValidateCommand {
	export interface Props {
		input: string;
	}
}

/** CLI command that runs the production completed-game compiler and validators. */
export const ValidateCommand = ({ input }: ValidateCommand.Props) =>
	Command.make(
		"validate",
		{
			input: Args.directory({
				name: "input",
			}).pipe(Args.withDefault(input)),
		},
		({ input }) =>
			Effect.gen(function* () {
				const result = yield* compileGameDirectoryFx({
					input,
				});
				yield* renderGameDiagnosticsFx(result.diagnostics);
				yield* assertGameConfigValidFx(result);
				yield* Console.log(`Validated ${input}.`);
			}),
	).pipe(
		Command.withDescription(
			"Compile and validate one fragmented game-authoring directory without packing it.",
		),
	);
