import { Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";
import { writeGameProjectJsonSchemaFx } from "~/game-config/source/json-schema/writeGameProjectJsonSchemaFx";

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
	yield* writeGameProjectJsonSchemaFx({
		output,
	});
	yield* Console.log(`Generated ${output}.`);
});

/**
 * CLI command that generates the JSON Schema for portable game-project authoring.
 */
export const SchemaCommand = ({ output }: SchemaCommand.Props) =>
	Command.make(
		"schema",
		{
			output: Flag.string("output").pipe(
				Flag.withDefault(output),
				Flag.withDescription("Destination where the generated JSON Schema is written."),
			),
		},
		({ output }) =>
			runSchemaCommandFx({
				output,
			}),
	).pipe(Command.withDescription("Generate the current game-project JSON Schema."));
