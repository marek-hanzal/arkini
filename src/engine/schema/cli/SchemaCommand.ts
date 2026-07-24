import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { writeGameJsonSchemaFx } from "~/engine/schema/fx/writeGameJsonSchemaFx";

export namespace SchemaCommand {
	export interface Props {
		/**
		 * Destination where the generated JSON Schema is written.
		 */
		output: string;
	}
}

const runSchemaCommandFx = Effect.fn("runSchemaCommandFx")(function* ({
	output,
}: SchemaCommand.Props) {
	yield* writeGameJsonSchemaFx({
		output,
	});
	yield* Console.log(`Generated ${output}.`);
});

/**
 * CLI command that generates the JSON Schema for game-configuration authoring.
 */
export const SchemaCommand = ({ output }: SchemaCommand.Props) =>
	Command.make(
		"schema",
		{
			output: Options.text("output").pipe(
				Options.withDefault(output),
				Options.withDescription("Destination where the generated JSON Schema is written."),
			),
		},
		({ output }) =>
			runSchemaCommandFx({
				output,
			}),
	).pipe(Command.withDescription("Generate the current game configuration JSON Schema."));
