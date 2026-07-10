import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";

import { packGameDirectoryFx } from "~/v1/pack/fx/packGameDirectoryFx";

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
				const result = yield* packGameDirectoryFx({
					input,
				});

				yield* Console.log(
					`Packed ${result.jsonSourceCount} JSON sources and ${result.pngAssetCount} PNG assets.`,
				);
				yield* Console.log(`Wrote ${result.output} (${result.byteLength} bytes).`);
			}),
	).pipe(
		Command.withDescription(
			"Pack JSON game sources and PNG assets into a compressed `.arkpack` file.",
		),
	);
