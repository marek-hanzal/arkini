import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { packDirectoryFx } from "~/engine/pack/fx/packDirectoryFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export namespace PackCommand {
	export interface Props {
		input: string;
		name?: string;
		packageId: string;
		version: ArkpackVersionSchema.Type;
	}
}

namespace runPackCommandFx {
	export interface Props {
		readonly input: string;
		readonly packageId: string;
		readonly version: ArkpackVersionSchema.Type;
	}
}

const runPackCommandFx = Effect.fn("runPackCommandFx")(function* ({
	input,
	packageId,
	version,
}: runPackCommandFx.Props) {
	const result = yield* packDirectoryFx({
		input,
		packageId,
		version,
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
export const PackCommand = ({ input, name = "pack", packageId, version }: PackCommand.Props) =>
	Command.make(
		name,
		{
			input: Argument.directory("input").pipe(Argument.withDefault(input)),
		},
		({ input }) =>
			runPackCommandFx({
				input,
				packageId,
				version,
			}),
	).pipe(
		Command.withDescription(
			"Pack JSON game sources and PNG assets into a compressed `.arkpack` file.",
		),
	);
