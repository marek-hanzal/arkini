import { Command } from "@effect/cli";
import { Console, Effect } from "effect";

import { gameJsonSchemaPath, writeGameJsonSchemaFx } from "~/v1/schema/fx/writeGameJsonSchemaFx";

/**
 * CLI command that generates the JSON Schema for game-configuration authoring.
 */
export const SchemaCommand = Command.make("schema", {}, () =>
	Effect.gen(function* () {
		yield* writeGameJsonSchemaFx;
		yield* Console.log(`Generated ${gameJsonSchemaPath}.`);
	}),
).pipe(Command.withDescription("Generate the current game configuration JSON Schema."));
