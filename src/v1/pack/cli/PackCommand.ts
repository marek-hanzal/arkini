import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/v1/pack/fx/packDirectoryFx";
import { renderGameDiagnosticsFx } from "~/v1/validation/fx/renderGameDiagnosticsFx";

export namespace PackCommand {
	export interface Props {
		input: string;
	}
}

/**
 * CLI command that packs one game source directory into an Arkini binary package.
 */
export const PackCommand = ({ input }: PackCommand.Props) =>
	Command.make(
		"pack",
		{
			input: Args.directory({
				name: "input",
			}).pipe(Args.withDefault(input)),
		},
		({ input }) =>
			Effect.gen(function* () {
				const result = yield* packDirectoryFx({
					input,
				}).pipe(
					Effect.catchTag("GameValidationError", (error) =>
						renderGameDiagnosticsFx(error.diagnostics).pipe(
							Effect.zipRight(Effect.fail(error)),
						),
					),
				);
				yield* renderGameDiagnosticsFx(result.diagnostics);

				yield* Console.log(
					`Packed ${result.json} JSON sources and ${result.png} PNG assets.`,
				);
				yield* Console.log(`Wrote ${result.output} (${result.bytes} bytes).`);
			}),
	).pipe(
		Command.withDescription(
			"Pack JSON game sources and PNG assets into a compressed `.arkpack` file.",
		),
	);
